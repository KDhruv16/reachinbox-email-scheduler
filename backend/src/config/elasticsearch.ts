import { Client } from '@elastic/elasticsearch';
import { ENV } from './env.js';

let esClientInstance: Client | null = null;
let isEsAvailable = false;

export const INDEX_NAME = 'email_records';

export function getElasticsearchClient(): Client {
  if (!esClientInstance) {
    esClientInstance = new Client({
      node: ENV.ELASTICSEARCH_URL,
      maxRetries: 3,
      requestTimeout: 4000,
    });
  }
  return esClientInstance;
}

export async function initElasticsearch(): Promise<boolean> {
  try {
    const client = getElasticsearchClient();
    await client.ping();
    isEsAvailable = true;
    console.log('[Elasticsearch] Connected to ' + ENV.ELASTICSEARCH_URL);

    const exists = await client.indices.exists({ index: INDEX_NAME });
    if (!exists) {
      await client.indices.create({
        index: INDEX_NAME,
        body: {
          mappings: {
            properties: {
              id: { type: 'keyword' },
              userId: { type: 'keyword' },
              sender: { type: 'keyword' },
              recipient: { type: 'keyword' },
              subject: { type: 'text', analyzer: 'standard' },
              body: { type: 'text', analyzer: 'standard' },
              status: { type: 'keyword' },
              scheduledAt: { type: 'date' },
              sentAt: { type: 'date' },
              failedAt: { type: 'date' },
              previewUrl: { type: 'keyword' },
              createdAt: { type: 'date' },
            },
          },
        },
      });
      console.log(`[Elasticsearch] Index "${INDEX_NAME}" created successfully.`);
    }
    return true;
  } catch (error: any) {
    isEsAvailable = false;
    console.warn('[Elasticsearch] Unavailable or connection failed (' + error.message + '). App will operate with database search fallback.');
    return false;
  }
}

export function isElasticsearchReady(): boolean {
  return isEsAvailable;
}
