import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import * as fs from "fs/promises"
import * as os from "os"
import * as path from "path"
import * as vscode from "vscode"

const hoisted = vi.hoisted(() => ({
	safeWriteJsonMock: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("../../../utils/safeWriteJson", () => ({
	safeWriteJson: hoisted.safeWriteJsonMock,
}))

import { GlobalFileNames } from "../../../shared/globalFileNames"
import { FileContextTracker } from "../../context-tracking/FileContextTracker"
import {
	readApiMessages,
	readTaskHistory,
	readTaskMessages,
	saveApiMessages,
	saveTaskHistory,
	saveTaskMessages,
} from ".."

describe("project-local task history persistence", () => {
	let tmpRoot: string
	let workspacePath: string
	let globalStoragePath: string

	const taskId = "task-1"

	const historyPath = (...parts: string[]) => path.join(workspacePath, ".kilocode", "history", ...parts)
	const taskPath = (...parts: string[]) => historyPath("tasks", taskId, ...parts)

	beforeEach(async () => {
		vi.clearAllMocks()
		tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "kilocode-history-"))
		workspacePath = path.join(tmpRoot, "workspace")
		globalStoragePath = path.join(tmpRoot, "global-storage")

		await fs.mkdir(workspacePath, { recursive: true })
		await fs.mkdir(globalStoragePath, { recursive: true })
		;(vscode.workspace as any).workspaceFolders = [{ uri: { fsPath: workspacePath } }]
		;(vscode.window as any).activeTextEditor = null
		vi.spyOn(vscode.workspace, "getConfiguration").mockReturnValue({
			get: vi.fn().mockReturnValue(""),
		} as any)
	})

	afterEach(async () => {
		vi.restoreAllMocks()
		;(vscode.workspace as any).workspaceFolders = []
		;(vscode.window as any).activeTextEditor = null

		if (tmpRoot) {
			await fs.rm(tmpRoot, { recursive: true, force: true })
		}
	})

	it("saves API and UI messages under .kilocode/history/tasks/<taskId>", async () => {
		const apiMessages: any[] = [{ role: "user", content: "hello" }]
		const uiMessages: any[] = [{ type: "say", say: "text", text: "hello", ts: 1 }]

		await saveApiMessages({ messages: apiMessages, taskId, globalStoragePath })
		await saveTaskMessages({ messages: uiMessages, taskId, globalStoragePath })

		expect(hoisted.safeWriteJsonMock).toHaveBeenCalledWith(
			taskPath(GlobalFileNames.apiConversationHistory),
			apiMessages,
		)
		expect(hoisted.safeWriteJsonMock).toHaveBeenCalledWith(taskPath(GlobalFileNames.uiMessages), uiMessages)
	})

	it("loads API and UI messages from .kilocode/history/tasks/<taskId>", async () => {
		const apiMessages: any[] = [{ role: "assistant", content: "loaded api" }]
		const uiMessages: any[] = [{ type: "say", say: "text", text: "loaded ui", ts: 2 }]

		await fs.mkdir(taskPath(), { recursive: true })
		await fs.writeFile(taskPath(GlobalFileNames.apiConversationHistory), JSON.stringify(apiMessages), "utf8")
		await fs.writeFile(taskPath(GlobalFileNames.uiMessages), JSON.stringify(uiMessages), "utf8")

		await expect(readApiMessages({ taskId, globalStoragePath })).resolves.toEqual(apiMessages)
		await expect(readTaskMessages({ taskId, globalStoragePath })).resolves.toEqual(uiMessages)
	})

	it("saves and loads task metadata under .kilocode/history/tasks/<taskId>", async () => {
		const provider = {
			contextProxy: { globalStorageUri: { fsPath: globalStoragePath } },
			postMessageToWebview: vi.fn(),
		}
		const tracker = new FileContextTracker(provider as any, taskId)
		const metadata = {
			files_in_context: [
				{
					path: "src/index.ts",
					record_state: "active" as const,
					record_source: "read_tool" as const,
					roo_read_date: 1,
					roo_edit_date: null,
				},
			],
		}

		await tracker.saveTaskMetadata(taskId, metadata)

		expect(hoisted.safeWriteJsonMock).toHaveBeenCalledWith(taskPath(GlobalFileNames.taskMetadata), metadata)
		expect(provider.postMessageToWebview).toHaveBeenCalledWith({
			type: "taskMetadataSaved",
			payload: [taskId, taskPath(GlobalFileNames.taskMetadata)],
		})

		await fs.mkdir(taskPath(), { recursive: true })
		await fs.writeFile(taskPath(GlobalFileNames.taskMetadata), JSON.stringify(metadata), "utf8")

		await expect(tracker.getTaskMetadata(taskId)).resolves.toEqual(metadata)
	})

	it("saves and loads task_history.json under .kilocode/history", async () => {
		const history: any[] = [{ id: taskId, ts: 1, task: "Project-local task", workspace: workspacePath }]

		await saveTaskHistory({ history, globalStoragePath })

		expect(hoisted.safeWriteJsonMock).toHaveBeenCalledWith(historyPath(GlobalFileNames.taskHistory), history)

		await fs.mkdir(historyPath(), { recursive: true })
		await fs.writeFile(historyPath(GlobalFileNames.taskHistory), JSON.stringify(history), "utf8")

		await expect(readTaskHistory({ globalStoragePath })).resolves.toEqual(history)
	})
})
