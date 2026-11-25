import {
  getElasticsearchClient,
  INDEX_NAME,
  isElasticsearchReady,
} from '../config/elasticsearch.js';
import { prisma } from '../lib/prisma.js';

export interface EmailDocument {
  id: string;
  userId: string;
  sender: string;
  recipient: string;
  subject: string;
  body: string;
  status: string;
  scheduledAt: string;
  sentAt?: string | null;
  failedAt?: string | null;
  previewUrl?: string | null;
  messageId?: string | null;
  createdAt: string;
}

export async function indexEmailRecord(record: {
  id: string;
  userId: string;
  sender: string;
  recipient: string;
  subject: string;
  body: string;
  status: string;
  scheduledAt: Date;
  sentAt?: Date | null;
  failedAt?: Date | null;
  previewUrl?: string | null;
  messageId?: string | null;
  createdAt: Date;
}): Promise<void> {
  if (!isElasticsearchReady()) {
    return;
  }

  try {
    const client = getElasticsearchClient();
    const doc: EmailDocument = {
      id: record.id,
      userId: record.userId,
      sender: record.sender,
      recipient: record.recipient,
      subject: record.subject,
      body: record.body,
      status: record.status,
      scheduledAt: record.scheduledAt.toISOString(),
      sentAt: record.sentAt ? record.sentAt.toISOString() : null,
      failedAt: record.failedAt ? record.failedAt.toISOString() : null,
      previewUrl: record.previewUrl || null,
      messageId: record.messageId || null,
      createdAt: record.createdAt.toISOString(),
    };

    await client.index({
      index: INDEX_NAME,
      id: record.id,
      document: doc,
    });
  } catch (error: any) {
    console.warn(`[Elasticsearch] Failed to index email ${record.id}:`, error.message);
  }
}

export async function searchEmails(
  userId: string,
  query: string,
  status?: string,
  page: number = 1,
  limit: number = 20
) {
  let statusList: string[] | undefined;
  if (status === 'scheduled_group') {
    statusList = ['SCHEDULED', 'DELAYED', 'PROCESSING'];
  } else if (status === 'sent_group') {
    statusList = ['SENT', 'FAILED'];
  } else if (status) {
    statusList = [status.toUpperCase()];
  }

  if (isElasticsearchReady() && query.trim().length > 0) {
    try {
      const client = getElasticsearchClient();
      const from = (page - 1) * limit;

      const mustClauses: any[] = [{ term: { userId: userId } }];

      if (statusList && statusList.length > 0) {
        mustClauses.push({
          terms: { status: statusList },
        });
      }

      mustClauses.push({
        multi_match: {
          query,
          fields: ['subject^3', 'body', 'recipient^2', 'sender'],
          fuzziness: 'AUTO',
        },
      });

      const response = await client.search({
        index: INDEX_NAME,
        from,
        size: limit,
        body: {
          query: {
            bool: {
              must: mustClauses,
            },
          },
          sort: [{ scheduledAt: { order: 'desc' } }],
        },
      });

      const total =
        typeof response.hits.total === 'number'
          ? response.hits.total
          : response.hits.total?.value || 0;

      const results = response.hits.hits.map((hit) => hit._source);

      return {
        source: 'elasticsearch',
        total,
        page,
        limit,
        emails: results,
      };
    } catch (error: any) {
      console.warn('[Elasticsearch] Search failed, falling back to PostgreSQL:', error.message);
    }
  }

  // Graceful fallback to PostgreSQL search
  const whereClause: any = {
    userId,
    ...(statusList ? { status: { in: statusList } } : {}),
  };

  if (query.trim().length > 0) {
    whereClause.OR = [
      { subject: { contains: query, mode: 'insensitive' } },
      { body: { contains: query, mode: 'insensitive' } },
      { recipient: { contains: query, mode: 'insensitive' } },
      { sender: { contains: query, mode: 'insensitive' } },
    ];
  }

  const [total, emails] = await Promise.all([
    prisma.emailJob.count({ where: whereClause }),
    prisma.emailJob.findMany({
      where: whereClause,
      orderBy: { scheduledAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return {
    source: 'postgres',
    total,
    page,
    limit,
    emails,
  };
}

export async function reindexAllEmails(): Promise<{ totalReindexed: number }> {
  const client = getElasticsearchClient();
  const allEmails = await prisma.emailJob.findMany();

  let count = 0;
  for (const email of allEmails) {
    await client.index({
      index: INDEX_NAME,
      id: email.id,
      document: {
        id: email.id,
        userId: email.userId,
        sender: email.sender,
        recipient: email.recipient,
        subject: email.subject,
        body: email.body,
        status: email.status,
        scheduledAt: email.scheduledAt.toISOString(),
        sentAt: email.sentAt ? email.sentAt.toISOString() : null,
        failedAt: email.failedAt ? email.failedAt.toISOString() : null,
        previewUrl: email.previewUrl || null,
        messageId: email.messageId || null,
        createdAt: email.createdAt.toISOString(),
      },
    });
    count++;
  }

  return { totalReindexed: count };
}
