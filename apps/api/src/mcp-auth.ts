import { createHash } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { prisma } from "@repo/db";

export type DementiaRequest = Request & { workspaceId?: string };

export async function requireDementiaApiKey(
  req: DementiaRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const header = req.headers.authorization;
    const secret = (header?.startsWith("Bearer ") ? header.slice(7) : header)?.trim()
      ?? (typeof req.headers["x-dementia-api-key"] === "string" ? req.headers["x-dementia-api-key"].trim() : "");
    if (!secret) return res.status(401).json({ error: "DEMENTIA_API_KEY is required" });

    const keyHash = createHash("sha256").update(secret).digest("hex");
    const apiKey = await prisma.apiKey.findFirst({
      where: {
        keyHash,
        revokedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      select: { id: true, workspaceId: true },
    });
    if (!apiKey) return res.status(401).json({ error: "DEMENTIA_API_KEY is invalid, revoked, or expired" });

    await prisma.apiKey.update({
      where: { id: apiKey.id },
      data: { lastUsedAt: new Date() },
    });

    req.workspaceId = apiKey.workspaceId;
    next();
  } catch (error) {
    next(error);
  }
}

export async function getAgentSession(workspaceId: string, externalId: string): Promise<string> {
  const existing = await prisma.agentSession.findFirst({
    where: { workspaceId, externalId },
    select: { id: true },
    orderBy: { startedAt: "desc" },
  });
  if (existing) return existing.id;

  const session = await prisma.agentSession.create({
    data: { workspaceId, externalId, agent: "CODEX" },
    select: { id: true },
  });
  return session.id;
}
