import * as tls from "tls"
import * as vscode from "vscode"

import type { ProviderSettings } from "@roo-code/types"

export type NodeTlsVerificationOverrideReason = "debugProxy" | "profileCustomBaseUrl"

const disableReasons = new Set<NodeTlsVerificationOverrideReason>()
let originalNodeTlsRejectUnauthorized: string | undefined
let originalValueCaptured = false
let originalDefaultCACertificates: string[] | undefined
let originalDefaultCACertificatesCaptured = false
let customCACertificatesActive = false

type TlsWithDefaultCACertificates = typeof tls & {
	getCACertificates?: (type?: "default" | "system" | "bundled" | "extra") => string[]
	setDefaultCACertificates?: (certs: string[]) => void
}

const CUSTOM_BASE_URL_KEYS = [
	"anthropicBaseUrl",
	"apertisBaseUrl",
	"openRouterBaseUrl",
	"zenmuxBaseUrl",
	"openAiBaseUrl",
	"ollamaBaseUrl",
	"lmStudioBaseUrl",
	"googleGeminiBaseUrl",
	"openAiNativeBaseUrl",
	"mistralCodestralUrl",
	"deepSeekBaseUrl",
	"deepInfraBaseUrl",
	"doubaoBaseUrl",
	"moonshotBaseUrl",
	"minimaxBaseUrl",
	"requestyBaseUrl",
	"litellmBaseUrl",
	"inceptionLabsBaseUrl",
	"ovhCloudAiEndpointsBaseUrl",
	"aihubmixBaseUrl",
] as const satisfies readonly (keyof ProviderSettings)[]

function captureOriginalValue(): void {
	if (originalValueCaptured) {
		return
	}

	originalNodeTlsRejectUnauthorized = process.env.NODE_TLS_REJECT_UNAUTHORIZED
	originalValueCaptured = true
}

function restoreOriginalValue(): void {
	if (typeof originalNodeTlsRejectUnauthorized === "string") {
		process.env.NODE_TLS_REJECT_UNAUTHORIZED = originalNodeTlsRejectUnauthorized
	} else {
		delete process.env.NODE_TLS_REJECT_UNAUTHORIZED
	}

	originalNodeTlsRejectUnauthorized = undefined
	originalValueCaptured = false
}

function getTlsWithDefaultCACertificates(): Required<TlsWithDefaultCACertificates> {
	const tlsApi = tls as TlsWithDefaultCACertificates

	if (typeof tlsApi.getCACertificates !== "function" || typeof tlsApi.setDefaultCACertificates !== "function") {
		throw new Error(
			"Custom SSL certificate verification requires a VS Code extension host with Node.js 22.19.0 or newer.",
		)
	}

	return tlsApi as Required<TlsWithDefaultCACertificates>
}

function captureOriginalDefaultCACertificates(): string[] {
	if (originalDefaultCACertificatesCaptured && originalDefaultCACertificates) {
		return originalDefaultCACertificates
	}

	const tlsApi = getTlsWithDefaultCACertificates()
	originalDefaultCACertificates = tlsApi.getCACertificates("default")
	originalDefaultCACertificatesCaptured = true
	return originalDefaultCACertificates
}

function restoreDefaultCACertificates(): void {
	if (!originalDefaultCACertificatesCaptured || !originalDefaultCACertificates) {
		customCACertificatesActive = false
		return
	}

	const tlsApi = getTlsWithDefaultCACertificates()
	tlsApi.setDefaultCACertificates(originalDefaultCACertificates)
	customCACertificatesActive = false
}

export function setNodeTlsVerificationDisabled(reason: NodeTlsVerificationOverrideReason, disabled: boolean): void {
	if (disabled) {
		captureOriginalValue()
		disableReasons.add(reason)
		process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0" // lgtm[js/disabling-certificate-validation]
		return
	}

	disableReasons.delete(reason)

	if (disableReasons.size === 0 && originalValueCaptured) {
		restoreOriginalValue()
	}
}

export function restoreAllNodeTlsVerificationOverrides(): void {
	disableReasons.clear()

	if (originalValueCaptured) {
		restoreOriginalValue()
	}

	if (originalDefaultCACertificatesCaptured) {
		restoreDefaultCACertificates()
	}
}

function hasStringValue(value: unknown): value is string {
	return typeof value === "string" && value.trim().length > 0
}

export function hasCustomBaseUrl(settings: ProviderSettings | undefined): boolean {
	if (!settings) {
		return false
	}

	if (settings.awsBedrockEndpointEnabled && hasStringValue(settings.awsBedrockEndpoint)) {
		return true
	}

	return CUSTOM_BASE_URL_KEYS.some((key) => hasStringValue(settings[key]))
}

function extractPEMCertificates(certificateText: string): string[] {
	const matches = certificateText.match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g)

	if (!matches?.length) {
		throw new Error("The selected SSL certificate file does not contain a PEM certificate.")
	}

	return matches
}

async function readCertificateFromUri(uri: string): Promise<string> {
	const bytes = await vscode.workspace.fs.readFile(vscode.Uri.parse(uri))
	return Buffer.from(bytes).toString("utf8")
}

async function applyCustomCACertificate(uri: string): Promise<void> {
	const originalCertificates = captureOriginalDefaultCACertificates()
	const certificateText = await readCertificateFromUri(uri)
	const certificates = extractPEMCertificates(certificateText)
	const tlsApi = getTlsWithDefaultCACertificates()

	tlsApi.setDefaultCACertificates([...originalCertificates, ...certificates])
	customCACertificatesActive = true
}

function shouldUseCustomCACertificate(settings: ProviderSettings | undefined): settings is ProviderSettings {
	return Boolean(
		settings &&
			settings.sslVerificationEnabled === true &&
			hasCustomBaseUrl(settings) &&
			hasStringValue(settings.sslCertificateUri),
	)
}

export async function applyActiveProfileSslVerification(settings: ProviderSettings | undefined): Promise<void> {
	setNodeTlsVerificationDisabled(
		"profileCustomBaseUrl",
		Boolean(settings && settings.sslVerificationEnabled !== true && hasCustomBaseUrl(settings)),
	)

	if (!shouldUseCustomCACertificate(settings)) {
		if (customCACertificatesActive) {
			restoreDefaultCACertificates()
		}
		return
	}

	try {
		await applyCustomCACertificate(settings.sslCertificateUri!)
	} catch (error) {
		if (customCACertificatesActive || originalDefaultCACertificatesCaptured) {
			restoreDefaultCACertificates()
		}

		const message = error instanceof Error ? error.message : String(error)
		void vscode.window.showErrorMessage(`Failed to load custom SSL certificate: ${message}`)
	}
}

export function getNodeTlsVerificationOverrideState() {
	return {
		disabled: disableReasons.size > 0,
		reasons: [...disableReasons],
		originalNodeTlsRejectUnauthorized,
		customCACertificatesActive,
	}
}
