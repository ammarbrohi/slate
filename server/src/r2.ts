import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

import { env } from "./env";

const s3 = new S3Client({
  endpoint: env.s3.endpoint,
  region: env.s3.region,
  forcePathStyle: env.s3.forcePathStyle,
  credentials: {
    accessKeyId: env.s3.accessKeyId,
    secretAccessKey: env.s3.secretAccessKey,
  },
});

const fileKey = (projectId: string, fileId: string) =>
  `projects/${projectId}/${fileId}`;

export const putFile = async (
  projectId: string,
  fileId: string,
  body: Buffer,
  contentType = "application/octet-stream",
) => {
  await s3.send(
    new PutObjectCommand({
      Bucket: env.s3.bucket,
      Key: fileKey(projectId, fileId),
      Body: body,
      ContentType: contentType,
    }),
  );
};

export const getFile = async (
  projectId: string,
  fileId: string,
): Promise<Buffer | null> => {
  try {
    const res = await s3.send(
      new GetObjectCommand({
        Bucket: env.s3.bucket,
        Key: fileKey(projectId, fileId),
      }),
    );
    const bytes = await res.Body?.transformToByteArray();
    return bytes ? Buffer.from(bytes) : null;
  } catch (err: any) {
    if (err?.name === "NoSuchKey" || err?.$metadata?.httpStatusCode === 404) {
      return null;
    }
    throw err;
  }
};
