import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { QueryCommand, type QueryCommandInput } from "@aws-sdk/lib-dynamodb";
import {
  actorKey,
  ddb,
  isMovieItem,
  isRoleItem,
  movieKey,
  parseId,
  tableName,
  toRole,
} from "../shared/db";
import { response } from "../shared/http";
import { logRequest } from "../shared/request-logger";

// GET /movies/{movieID}/roles?[actor=actorID]
export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  logRequest(event);

  const movieId = parseId(event.pathParameters?.movieID);
  if (movieId === undefined) {
    return response(400, { message: "movieID must be a positive integer" });
  }

  const actorParam = event.queryStringParameters?.actor;
  const actorId = parseId(actorParam);
  if (actorParam !== undefined && actorId === undefined) {
    return response(400, { message: "actor must be a positive integer" });
  }

  // The movie's partition holds the movie item and one role item per actor.
  let queryInput: QueryCommandInput = {
    TableName: tableName,
    KeyConditionExpression: "PK = :pk",
    ExpressionAttributeValues: { ":pk": movieKey(movieId) },
  };
  if (actorId !== undefined) {
    // A role's sort key is the actor key, so this returns at most one item.
    queryInput = {
      ...queryInput,
      KeyConditionExpression: "PK = :pk AND SK = :sk",
      ExpressionAttributeValues: {
        ...queryInput.ExpressionAttributeValues,
        ":sk": actorKey(actorId),
      },
    };
  }

  try {
    const queryResult = await ddb.send(new QueryCommand(queryInput));
    const resultItems = queryResult.Items ?? [];

    if (actorId !== undefined && resultItems.length === 0) {
      return response(404, {
        message: `No role found for actor ${actorId} in movie ${movieId}`,
      });
    }
    // Without ?actor= the movie item itself is in the partition, if the movie exists.
    if (actorId === undefined && !resultItems.some(isMovieItem)) {
      return response(404, { message: `Movie ${movieId} not found` });
    }
    return response(200, { data: resultItems.filter(isRoleItem).map(toRole) });
  } catch (err) {
    // Log the details to CloudWatch, but never send them to the client.
    console.error("DynamoDB error:", err);
    return response(500, { message: "Internal server error" });
  }
};