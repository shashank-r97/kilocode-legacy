vi.mock("tls", () => ({
	getCACertificates: vi.fn(() => ["DEFAULT_CA"]),
	setDefaultCACertificates: vi.fn(),
}))

import * as tls from "tls"
import * as vscode from "vscode"

import {
	applyActiveProfileSslVerification,
	getNodeTlsVerificationOverrideState,
	hasCustomBaseUrl,
	restoreAllNodeTlsVerificationOverrides,
	setNodeTlsVerificationDisabled,
} from "../nodeTlsVerification"

const TEST_CERTIFICATE = `-----BEGIN CERTIFICATE-----
MIIBszCCAVmgAwIBAgIUTestCertificateForUnitTestsOnlywCgYIKoZIzj0EAwIw
EzERMA8GA1UEAwwIdGVzdC1jYTAeFw0yNDAxMDEwMDAwMDBaFw0zNDAxMDEwMDAw
MDBaMBMxETAPBgNVBAMMCHRlc3QtY2EwWTATBgcqhkjOPQIBBggqhkjOPQMBBwNC
AATestCertificateForUnitTestsOnlyTestCertificateForUnitTestsOnlyTest
CertificateForUnitTestsOnlyTestCertificateForUnitTestsOnlyTestCert==
-----END CERTIFICATE-----`

describe("nodeTlsVerification", () => {
	const originalNodeTlsRejectUnauthorized = process.env.NODE_TLS_REJECT_UNAUTHORIZED
	const mockedTls = vi.mocked(tls as any)

	beforeEach(() => {
		restoreAllNodeTlsVerificationOverrides()
		delete process.env.NODE_TLS_REJECT_UNAUTHORIZED
		vi.clearAllMocks()
		mockedTls.getCACertificates.mockReturnValue(["DEFAULT_CA"])
		vi.spyOn(vscode.workspace.fs, "readFile").mockResolvedValue(Buffer.from(TEST_CERTIFICATE))
		vi.spyOn(vscode.window, "showErrorMessage").mockResolvedValue(undefined)
	})

	afterEach(() => {
		restoreAllNodeTlsVerificationOverrides()
		delete process.env.NODE_TLS_REJECT_UNAUTHORIZED
		vi.restoreAllMocks()
	})

	afterAll(() => {
		restoreAllNodeTlsVerificationOverrides()

		if (typeof originalNodeTlsRejectUnauthorized === "string") {
			process.env.NODE_TLS_REJECT_UNAUTHORIZED = originalNodeTlsRejectUnauthorized
		} else {
			delete process.env.NODE_TLS_REJECT_UNAUTHORIZED
		}
	})

	it("does not disable TLS verification when no custom base URL is configured", async () => {
		await applyActiveProfileSslVerification({
			apiProvider: "openai",
			sslVerificationEnabled: false,
		})

		expect(process.env.NODE_TLS_REJECT_UNAUTHORIZED).toBeUndefined()
		expect(getNodeTlsVerificationOverrideState().disabled).toBe(false)
	})

	it("treats missing sslVerificationEnabled as false for custom base URL profiles", async () => {
		await applyActiveProfileSslVerification({
			apiProvider: "openai",
			openAiBaseUrl: "https://llm.local/v1",
		})

		expect(process.env.NODE_TLS_REJECT_UNAUTHORIZED).toBe("0")
		expect(getNodeTlsVerificationOverrideState().reasons).toContain("profileCustomBaseUrl")
	})

	it("keeps TLS verification enabled when the active profile explicitly selects true", async () => {
		await applyActiveProfileSslVerification({
			apiProvider: "openai",
			openAiBaseUrl: "https://llm.local/v1",
			sslVerificationEnabled: true,
		})

		expect(process.env.NODE_TLS_REJECT_UNAUTHORIZED).toBeUndefined()
		expect(getNodeTlsVerificationOverrideState().disabled).toBe(false)
	})

	it("restores the original environment value when profile TLS override is removed", async () => {
		process.env.NODE_TLS_REJECT_UNAUTHORIZED = "1"

		await applyActiveProfileSslVerification({
			apiProvider: "openai",
			openAiBaseUrl: "https://llm.local/v1",
			sslVerificationEnabled: false,
		})
		expect(process.env.NODE_TLS_REJECT_UNAUTHORIZED).toBe("0")

		await applyActiveProfileSslVerification({
			apiProvider: "openai",
			openAiBaseUrl: "https://llm.local/v1",
			sslVerificationEnabled: true,
		})

		expect(process.env.NODE_TLS_REJECT_UNAUTHORIZED).toBe("1")
	})

	it("does not clear another active TLS override reason when profile settings change", async () => {
		setNodeTlsVerificationDisabled("debugProxy", true)
		await applyActiveProfileSslVerification({
			apiProvider: "openai",
			openAiBaseUrl: "https://llm.local/v1",
			sslVerificationEnabled: false,
		})

		await applyActiveProfileSslVerification({
			apiProvider: "openai",
			openAiBaseUrl: "https://llm.local/v1",
			sslVerificationEnabled: true,
		})

		expect(process.env.NODE_TLS_REJECT_UNAUTHORIZED).toBe("0")
		expect(getNodeTlsVerificationOverrideState().reasons).toEqual(["debugProxy"])
	})

	it("adds a custom CA certificate when SSL verification is enabled", async () => {
		await applyActiveProfileSslVerification({
			apiProvider: "openai",
			openAiBaseUrl: "https://llm.local/v1",
			sslVerificationEnabled: true,
			sslCertificateUri: "vscode-remote://ssh-remote+host/etc/ssl/custom.pem",
		})

		expect(vscode.workspace.fs.readFile).toHaveBeenCalled()
		expect(mockedTls.setDefaultCACertificates).toHaveBeenCalledWith(["DEFAULT_CA", TEST_CERTIFICATE])
		expect(getNodeTlsVerificationOverrideState().customCACertificatesActive).toBe(true)
		expect(process.env.NODE_TLS_REJECT_UNAUTHORIZED).toBeUndefined()
	})

	it("restores default CA certificates when switching away from a custom CA profile", async () => {
		await applyActiveProfileSslVerification({
			apiProvider: "openai",
			openAiBaseUrl: "https://llm.local/v1",
			sslVerificationEnabled: true,
			sslCertificateUri: "file:///certs/custom.pem",
		})

		await applyActiveProfileSslVerification({
			apiProvider: "openai",
			openAiBaseUrl: "https://llm.local/v1",
			sslVerificationEnabled: true,
		})

		expect(mockedTls.setDefaultCACertificates).toHaveBeenLastCalledWith(["DEFAULT_CA"])
		expect(getNodeTlsVerificationOverrideState().customCACertificatesActive).toBe(false)
	})

	it("keeps verification enabled and restores default CAs for invalid custom CA files", async () => {
		vi.mocked(vscode.workspace.fs.readFile).mockResolvedValueOnce(Buffer.from("not a PEM certificate"))

		await applyActiveProfileSslVerification({
			apiProvider: "openai",
			openAiBaseUrl: "https://llm.local/v1",
			sslVerificationEnabled: true,
			sslCertificateUri: "file:///certs/invalid.pem",
		})

		expect(process.env.NODE_TLS_REJECT_UNAUTHORIZED).toBeUndefined()
		expect(mockedTls.setDefaultCACertificates).toHaveBeenCalledWith(["DEFAULT_CA"])
		expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
			expect.stringContaining("Failed to load custom SSL certificate"),
		)
	})

	it("keeps verification enabled and restores default CAs when custom CA files cannot be read", async () => {
		vi.mocked(vscode.workspace.fs.readFile).mockRejectedValueOnce(new Error("ENOENT: certificate missing"))

		await applyActiveProfileSslVerification({
			apiProvider: "openai",
			openAiBaseUrl: "https://llm.local/v1",
			sslVerificationEnabled: true,
			sslCertificateUri: "file:///certs/missing.pem",
		})

		expect(process.env.NODE_TLS_REJECT_UNAUTHORIZED).toBeUndefined()
		expect(mockedTls.setDefaultCACertificates).toHaveBeenCalledWith(["DEFAULT_CA"])
		expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(expect.stringContaining("ENOENT"))
	})

	it("detects AWS Bedrock custom endpoint only when endpoint mode is enabled", () => {
		expect(
			hasCustomBaseUrl({
				apiProvider: "bedrock",
				awsBedrockEndpoint: "https://vpce.example.com",
				awsBedrockEndpointEnabled: false,
			}),
		).toBe(false)

		expect(
			hasCustomBaseUrl({
				apiProvider: "bedrock",
				awsBedrockEndpoint: "https://vpce.example.com",
				awsBedrockEndpointEnabled: true,
			}),
		).toBe(true)
	})
})
