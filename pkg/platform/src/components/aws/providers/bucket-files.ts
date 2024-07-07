import fs from "fs";
import { CustomResourceOptions, Input, dynamic } from "@pulumi/pulumi";
import { awsFetch } from "../helpers/client.js";

export interface BucketFile {
  source: string;
  key: string;
  cacheControl?: string;
  contentType: string;
  hash?: string;
}

export interface BucketFilesInputs {
  bucketName: Input<string>;
  files: Input<BucketFile[]>;
}

interface Inputs {
  bucketName: string;
  files: BucketFile[];
}

class Provider implements dynamic.ResourceProvider {
  async create(inputs: Inputs): Promise<dynamic.CreateResult> {
    await this.upload(inputs.bucketName, inputs.files, []);
    return { id: "files" };
  }

  async update(
    id: string,
    olds: Inputs,
    news: Inputs,
  ): Promise<dynamic.UpdateResult> {
    await this.upload(
      news.bucketName,
      news.files,
      news.bucketName === olds.bucketName ? olds.files : [],
    );
    return {};
  }

  async upload(
    bucketName: string,
    files: BucketFile[],
    oldFiles: BucketFile[],
  ) {
    const oldFilesMap = new Map(oldFiles.map((f) => [f.key, f]));

    await Promise.all(
      files.map(async (file) => {
        const oldFile = oldFilesMap.get(file.key);
        if (
          oldFile &&
          oldFile.hash === file.hash &&
          oldFile.cacheControl === file.cacheControl &&
          oldFile.contentType === file.contentType
        ) {
          return;
        }

        await awsFetch(
          "s3",
          `https://${bucketName}.s3.us-east-1.amazonaws.com/${file.key}`,
          {
            method: "put",
            body: await fs.promises.readFile(file.source),
            headers: {
              ...(file.contentType ? { "Content-Type": file.contentType } : {}),
              ...(file.cacheControl
                ? { "Cache-Control": file.cacheControl }
                : {}),
            },
          },
        );
      }),
    );
  }
}

export class BucketFiles extends dynamic.Resource {
  constructor(
    name: string,
    args: BucketFilesInputs,
    opts?: CustomResourceOptions,
  ) {
    super(new Provider(), `${name}.sst.aws.BucketFiles`, args, opts);
  }
}
