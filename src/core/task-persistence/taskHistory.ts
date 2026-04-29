import * as fs from "fs/promises"

import type { HistoryItem } from "@roo-code/types"

import { safeWriteJson } from "../../utils/safeWriteJson"
import { fileExistsAtPath } from "../../utils/fs"
import { getTaskHistoryFilePath } from "../../utils/storage"

export type ReadTaskHistoryOptions = {
	globalStoragePath: string
}

export async function readTaskHistory({ globalStoragePath }: ReadTaskHistoryOptions): Promise<HistoryItem[]> {
	const filePath = await getTaskHistoryFilePath(globalStoragePath)

	if (!(await fileExistsAtPath(filePath))) {
		return []
	}

	try {
		const parsed = JSON.parse(await fs.readFile(filePath, "utf8"))
		return Array.isArray(parsed) ? parsed : []
	} catch (error) {
		console.error(
			`[KiloCode] Failed to read task history index at ${filePath}: ${
				error instanceof Error ? error.message : String(error)
			}`,
		)
		return []
	}
}

export type SaveTaskHistoryOptions = {
	history: HistoryItem[]
	globalStoragePath: string
}

export async function saveTaskHistory({ history, globalStoragePath }: SaveTaskHistoryOptions): Promise<void> {
	const filePath = await getTaskHistoryFilePath(globalStoragePath)
	await safeWriteJson(filePath, history)
}
