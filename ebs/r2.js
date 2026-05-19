import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand, CopyObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

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

export function r2SoundKey(userId, filename) {
  return `sounds/${userId}/${filename}`;
}

export async function putR2Object(key, body, contentType) {
  const cmd = new PutObjectCommand({
    Bucket: r2Bucket,
    Key: key,
    Body: body,
    ContentType: contentType,
  });
  return r2.send(cmd);
}

export async function deleteR2Object(key) {
  const cmd = new DeleteObjectCommand({ Bucket: r2Bucket, Key: key });
  return r2.send(cmd);
}

export async function getR2PresignedUrl(key, expiresIn = 3600) {
  const cmd = new GetObjectCommand({ Bucket: r2Bucket, Key: key });
  return getSignedUrl(r2, cmd, { expiresIn });
}

export async function getR2ObjectStream(key) {
  const cmd = new GetObjectCommand({ Bucket: r2Bucket, Key: key });
  const response = await r2.send(cmd);
  return response.Body;
}

export async function r2ObjectExists(key) {
  try {
    await r2.send(new HeadObjectCommand({ Bucket: r2Bucket, Key: key }));
    return true;
  } catch (err) {
    if (err?.name === 'NotFound' || err?.$metadata?.httpStatusCode === 404) return false;
    throw err;
  }
}

export async function copyR2Object(sourceKey, destKey) {
  const cmd = new CopyObjectCommand({
    Bucket: r2Bucket,
    CopySource: `${r2Bucket}/${sourceKey}`,
    Key: destKey,
  });
  return r2.send(cmd);
}
