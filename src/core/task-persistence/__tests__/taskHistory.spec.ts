import { beforeEach, describe, expect, it, vi } from "vitest"

const hoisted = vi.hoisted(() => ({
	fileExistsAtPathMock: vi.fn(),
	getTaskHistoryFilePathMock: vi.fn(),
	readFileMock: vi.fn(),
	safeWriteJsonMock: vi.fn(),
}))

vi.mock("../../../utils/fs", () => ({
	fileExistsAtPath: hoisted.fileExistsAtPathMock,
}))

vi.mock("../../../utils/storage", () => ({
	getTaskHistoryFilePath: hoisted.getTaskHistoryFilePathMock,
}))

vi.mock("../../../utils/safeWriteJson", () => ({
	safeWriteJson: hoisted.safeWriteJsonMock,
}))

vi.mock("fs/promises", () => ({
	readFile: hoisted.readFileMock,
}))

import { readTaskHistory, saveTaskHistory } from "../taskHistory"

describe("taskHistory persistence", () => {
	const globalStoragePath = "/test/global-storage"
	const taskHistoryPath = "/test/project/.kilocode/history/task_history.json"

	beforeEach(() => {
		vi.clearAllMocks()
		hoisted.getTaskHistoryFilePathMock.mockResolvedValue(taskHistoryPath)
		hoisted.safeWriteJsonMock.mockResolvedValue(undefined)
	})

	it("saves the task history index to the resolved history file", async () => {
		const history: any[] = [{ id: "task-1", ts: 1, task: "Test", workspace: "/test/project" }]

		await saveTaskHistory({ history, globalStoragePath })

		expect(hoisted.getTaskHistoryFilePathMock).toHaveBeenCalledWith(globalStoragePath)
		expect(hoisted.safeWriteJsonMock).toHaveBeenCalledWith(taskHistoryPath, history)
	})

	it("loads the task history index from the resolved history file", async () => {
		const history: any[] = [{ id: "task-1", ts: 1, task: "Test", workspace: "/test/project" }]
		hoisted.fileExistsAtPathMock.mockResolvedValue(true)
		hoisted.readFileMock.mockResolvedValue(JSON.stringify(history))

		const result = await readTaskHistory({ globalStoragePath })

		expect(result).toEqual(history)
		expect(hoisted.readFileMock).toHaveBeenCalledWith(taskHistoryPath, "utf8")
	})

	it("returns an empty history when the index file does not exist", async () => {
		hoisted.fileExistsAtPathMock.mockResolvedValue(false)

		const result = await readTaskHistory({ globalStoragePath })

		expect(result).toEqual([])
		expect(hoisted.readFileMock).not.toHaveBeenCalled()
	})

	it("returns an empty history when the index file is not an array", async () => {
		hoisted.fileExistsAtPathMock.mockResolvedValue(true)
		hoisted.readFileMock.mockResolvedValue(JSON.stringify({ id: "not-an-array" }))

		const result = await readTaskHistory({ globalStoragePath })

		expect(result).toEqual([])
	})
})
