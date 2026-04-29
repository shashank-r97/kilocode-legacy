vi.mock("delay", () => ({
	__esModule: true,
	default: vi.fn().mockResolvedValue(undefined),
}))

import delay from "delay"
import { Task } from "../Task"

// Keep this test focused: if a queued message arrives while Task.ask() is blocked,
// it should be consumed and used to fulfill the ask.

describe("Task.ask queued message drain", () => {
	it("consumes queued message while blocked on followup ask", async () => {
		const task = Object.create(Task.prototype) as Task
		;(task as any).abort = false
		;(task as any).clineMessages = []
		;(task as any).askResponse = undefined
		;(task as any).askResponseText = undefined
		;(task as any).askResponseImages = undefined
		;(task as any).lastMessageTs = undefined

		// Message queue service exists in constructor; for unit test we can attach a real one.
		const { MessageQueueService } = await import("../../message-queue/MessageQueueService")
		;(task as any).messageQueueService = new MessageQueueService()

		// Minimal stubs used by ask()
		;(task as any).addToClineMessages = vi.fn(async () => {})
		;(task as any).saveClineMessages = vi.fn(async () => {})
		;(task as any).updateClineMessage = vi.fn(async () => {})
		;(task as any).cancelAutoApprovalTimeout = vi.fn(() => {})
		;(task as any).checkpointSave = vi.fn(async () => {})
		;(task as any).emit = vi.fn()
		;(task as any).providerRef = { deref: () => undefined }

		const askPromise = task.ask("followup", "Q?", false)

		// Simulate webview queuing the user's selection text while the ask is pending.
		;(task as any).messageQueueService.addMessage("picked answer")

		const result = await askPromise
		expect(result.response).toBe("messageResponse")
		expect(result.text).toBe("picked answer")
	})

	it("marks auto-approved command asks before approving them", async () => {
		const task = Object.create(Task.prototype) as Task
		;(task as any).abort = false
		;(task as any).clineMessages = []
		;(task as any).askResponse = undefined
		;(task as any).askResponseText = undefined
		;(task as any).askResponseImages = undefined
		;(task as any).lastMessageTs = undefined
		;(task as any).autoApprovalTimeoutRef = undefined
		;(task as any).messageQueueService = {
			isEmpty: vi.fn(() => true),
			dequeueMessage: vi.fn(),
		}
		;(task as any).providerRef = {
			deref: () => ({
				getState: vi.fn().mockResolvedValue({
					autoApprovalEnabled: true,
					alwaysAllowExecute: true,
					allowedCommands: ["*"],
					deniedCommands: [],
				}),
			}),
		}
		;(task as any).addToClineMessages = vi.fn(async (message) => {
			;(task as any).clineMessages.push(message)
		})
		;(task as any).saveClineMessages = vi.fn(async () => {})
		;(task as any).updateClineMessage = vi.fn(async () => {})
		;(task as any).checkpointSave = vi.fn(async () => {})
		;(task as any).emit = vi.fn()

		const result = await task.ask("command", "npm test", false)
		const commandMessage = (task as any).clineMessages[0]

		expect(result.response).toBe("yesButtonClicked")
		expect(commandMessage).toMatchObject({
			type: "ask",
			ask: "command",
			text: "npm test",
			autoApproved: true,
		})
		expect((task as any).saveClineMessages).toHaveBeenCalled()
		expect((task as any).updateClineMessage).toHaveBeenCalledWith(commandMessage)
		expect(delay).toHaveBeenCalledWith(250)
	})
})
