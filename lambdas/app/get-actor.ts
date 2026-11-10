import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { GetCommand } from "@aws-sdk/lib-dynamodb";
import {
  type ActorProfile,
  actorKey,
  ddb,
  movieKey,
  parseId,
  tableName,
  toActor,
  toRole,
} from "../shared/db";
import { response } from "../shared/http";
import { logRequest } from "../shared/request-logger";

// GET /actors/{actorID}?[movie=movieID]
export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  logRequest(event);

  const actorId = parseId(event.pathParameters?.actorID);
  if (actorId === undefined) {
    return response(400, { message: "actorID must be a positive integer" });
  }

  const movieParam = event.queryStringParameters?.movie;
  const movieId = parseId(movieParam);
  if (movieParam !== undefined && movieId === undefined) {
    return response(400, { message: "movie must be a positive integer" });
  }
  try {
    const actorResult = await ddb.send(
      new GetCommand({
        TableName: tableName,
        Key: { PK: actorKey(actorId), SK: actorKey(actorId) },
      })
    );

    if (!actorResult.Item) {
      return response(404, { message: `Actor ${actorId} not found` });
    }
    const profile: ActorProfile = toActor(actorResult.Item);

    if (movieId !== undefined) {
      // A role item is keyed by movie (PK) and actor (SK).
      const roleResult = await ddb.send(
        new GetCommand({
          TableName: tableName,
          Key: { PK: movieKey(movieId), SK: actorKey(actorId) },
        })
      );
      if (roleResult.Item) {
        profile.roleDescription = toRole(roleResult.Item).roleDescription;
      }
    }
    return response(200, { data: profile });
  } catch (err) {
    // Log the details to CloudWatch, but never send them to the client.
    console.error("DynamoDB error:", err);
    return response(500, { message: "Internal server error" });
  }
};