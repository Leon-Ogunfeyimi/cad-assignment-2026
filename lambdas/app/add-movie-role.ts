import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import type { TransactionCanceledException } from "@aws-sdk/client-dynamodb";
import { TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import {
  actorKey,
  ddb,
  invalidRoleFields,
  movieKey,
  type Role,
  tableName,
  toRole,
} from "../shared/db";
import { isResponse, parseJsonObject, response } from "../shared/http";
import { logRequest } from "../shared/request-logger";

// The response for each failed condition, in the same order as TransactItems below.
const conditionFailures = (role: Role): [number, string][] => [
  [404, `Movie ${role.movieId} not found`],
  [404, `Actor ${role.actorId} not found`],
  [409, `Actor ${role.actorId} already has a role in movie ${role.movieId}`],
];

// POST /movies/roles  { movieId, actorId, roleName, roleDescription }
export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  logRequest(event);

  const body = parseJsonObject(event);
  if (isResponse(body)) return body;

  const invalidFields = invalidRoleFields(body);
  if (invalidFields.length) {
    return response(400, {
      message: `Missing or invalid fields: ${invalidFields.join(", ")}`,
    });
  }
  // toRole keeps only the Role fields, so extra properties are never stored.
  const role = toRole(body);
  const movie = movieKey(role.movieId);
  const actor = actorKey(role.actorId);

  try {
    // All or nothing: the role is written only if the movie and actor exist
    // and the actor has no role in that movie yet.
    await ddb.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            ConditionCheck: {
              TableName: tableName,
              Key: { PK: movie, SK: movie },
              ConditionExpression: "attribute_exists(PK)",
            },
          },
          {
            ConditionCheck: {
              TableName: tableName,
              Key: { PK: actor, SK: actor },
              ConditionExpression: "attribute_exists(PK)",
            },
          },
          {
            Put: {
              TableName: tableName,
              Item: { PK: movie, SK: actor, ...role },
              ConditionExpression: "attribute_not_exists(PK)",
            },
          },
        ],
      })
    );
    return response(201, { message: "Role added", data: role });
  } catch (err) {
    if ((err as Error).name === "TransactionCanceledException") {
      const reasons = (err as TransactionCanceledException).CancellationReasons ?? [];
      const failed = reasons.findIndex((r) => r.Code === "ConditionalCheckFailed");
      if (failed !== -1) {
        const [status, message] = conditionFailures(role)[failed];
        return response(status, { message });
      }
    }
    console.error("DynamoDB error:", err);
    return response(500, { message: "Internal server error" });
  }
};