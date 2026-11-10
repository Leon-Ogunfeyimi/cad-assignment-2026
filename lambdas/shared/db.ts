import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, type QueryCommandInput } from '@aws-sdk/lib-dynamodb';

export const ddb = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: process.env.REGION }),
  { marshallOptions: { removeUndefinedValues: true } },
);
export const tableName = process.env.TABLE_NAME!;

// A single Query returns at most 1 MB, so follow LastEvaluatedKey until every page is read.
export const queryAll = async (input: QueryCommandInput): Promise<Record<string, any>[]> => {
  const items: Record<string, any>[] = [];
  let lastKey: Record<string, any> | undefined;
  do {
    const page = await ddb.send(new QueryCommand({ ...input, ExclusiveStartKey: lastKey }));
    items.push(...(page.Items ?? []));
    lastKey = page.LastEvaluatedKey;
  } while (lastKey);
  return items;
};

export * from './model';