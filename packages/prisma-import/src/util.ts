import { getPrismaConfigFromPackageJson } from "@prisma/internals";
import { PrismaImportConfig } from "./types";
import fs from "fs";
import _glob from "glob";
import { promisify } from "util";

export const exists = promisify(fs.exists);
export const readFile = promisify(fs.readFile);
export const mkdir = promisify(fs.mkdir);
export const writeFile = promisify(fs.writeFile);
export const glob = promisify(_glob);

export const getConfigFromPackageJson = async (
  key: keyof NonNullable<PrismaImportConfig["import"]>
): Promise<string | undefined> => {
  const prismaConfig = (await getPrismaConfigFromPackageJson(
    process.cwd()
  )) as { data: PrismaImportConfig | undefined; packagePath: string } | null;

  return prismaConfig?.data?.import?.[key];
};
