import { S3Client } from '@aws-sdk/client-s3';

const accountId = process.env.R2_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const bucket = process.env.R2_BUCKET;

export const r2Enabled = Boolean(accountId && accessKeyId && secretAccessKey && bucket);
export const r2Bucket = bucket;

// R2 always uses 'auto' as region. Endpoint is account-scoped; the bucket name
// goes in the request body, not the URL. See:
// https://developers.cloudflare.com/r2/api/s3/api/
export const r2 = r2Enabled
  ? new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    })
  : null;
