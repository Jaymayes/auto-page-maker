import { Storage } from "@google-cloud/storage";
import { randomUUID } from "crypto";

const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";

const storageClient = new Storage({
  credentials: {
    audience: "replit",
    subject_token_type: "access_token",
    token_url: `${REPLIT_SIDECAR_ENDPOINT}/token`,
    type: "external_account",
    credential_source: {
      url: `${REPLIT_SIDECAR_ENDPOINT}/credential`,
      format: {
        type: "json",
        subject_token_field_name: "access_token",
      },
    },
    universe_domain: "googleapis.com",
  },
  projectId: "",
});

interface UploadResult {
  objectPath: string;
  signedUrl: string;
  filename: string;
}

export class ObjectStorageService {
  private getPrivateObjectDir(): string {
    const dir = process.env.PRIVATE_OBJECT_DIR || "";
    if (!dir) {
      throw new Error("PRIVATE_OBJECT_DIR not set. Configure object storage first.");
    }
    return dir;
  }

  private parseObjectPath(path: string): { bucketName: string; objectName: string } {
    if (!path.startsWith("/")) {
      path = `/${path}`;
    }
    const pathParts = path.split("/");
    if (pathParts.length < 3) {
      throw new Error("Invalid path: must contain at least a bucket name");
    }

    const bucketName = pathParts[1];
    const objectName = pathParts.slice(2).join("/");

    return { bucketName, objectName };
  }

  async uploadBuffer(
    buffer: Buffer,
    filename: string,
    contentType: string = "application/pdf"
  ): Promise<UploadResult> {
    const privateDir = this.getPrivateObjectDir();
    const objectId = randomUUID();
    const objectPath = `${privateDir}/generated/${objectId}/${filename}`;

    const { bucketName, objectName } = this.parseObjectPath(objectPath);
    const bucket = storageClient.bucket(bucketName);
    const file = bucket.file(objectName);

    await file.save(buffer, {
      metadata: {
        contentType,
        metadata: {
          generatedAt: new Date().toISOString(),
          service: "auto_page_maker",
        },
      },
    });

    console.log(`[OBJECT_STORAGE] Uploaded file: ${objectPath} (${buffer.length} bytes)`);

    const signedUrl = await this.getSignedUrl(bucketName, objectName, 3600);

    return {
      objectPath,
      signedUrl,
      filename,
    };
  }

  async getSignedUrl(
    bucketName: string,
    objectName: string,
    ttlSec: number = 3600
  ): Promise<string> {
    const request = {
      bucket_name: bucketName,
      object_name: objectName,
      method: "GET",
      expires_at: new Date(Date.now() + ttlSec * 1000).toISOString(),
    };

    const response = await fetch(
      `${REPLIT_SIDECAR_ENDPOINT}/object-storage/signed-object-url`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(request),
      }
    );

    if (!response.ok) {
      throw new Error(
        `Failed to sign object URL, status: ${response.status}. ` +
        `Ensure you're running on Replit with object storage configured.`
      );
    }

    const { signed_url: signedURL } = await response.json();
    return signedURL;
  }
}

export const objectStorageService = new ObjectStorageService();
