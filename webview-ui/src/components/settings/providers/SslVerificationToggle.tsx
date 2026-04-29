import { useCallback, useRef } from "react"
import { useEvent } from "react-use"
import { VSCodeTextField } from "@vscode/webview-ui-toolkit/react"

import type { ExtensionMessage, ProviderSettings } from "@roo-code/types"

import { useAppTranslation } from "@src/i18n/TranslationContext"
import { Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@src/components/ui"
import { vscode } from "@src/utils/vscode"

type SslVerificationToggleProps = {
	apiConfiguration: ProviderSettings
	setApiConfigurationField: (field: keyof ProviderSettings, value: ProviderSettings[keyof ProviderSettings]) => void
}

export const SslVerificationToggle = ({ apiConfiguration, setApiConfigurationField }: SslVerificationToggleProps) => {
	const { t } = useAppTranslation()
	const sslVerificationEnabled = apiConfiguration.sslVerificationEnabled ?? false
	const pendingCertificateRequestId = useRef<string | undefined>(undefined)

	const handleCertificateSelected = useCallback(
		(event: MessageEvent) => {
			const message = event.data as ExtensionMessage

			if (
				message.type !== "sslCertificateSelected" ||
				!message.requestId ||
				message.requestId !== pendingCertificateRequestId.current
			) {
				return
			}

			pendingCertificateRequestId.current = undefined

			if (!message.uri || !message.displayPath) {
				return
			}

			setApiConfigurationField("sslCertificateUri", message.uri)
			setApiConfigurationField("sslCertificateDisplayPath", message.displayPath)
		},
		[setApiConfigurationField],
	)

	useEvent("message", handleCertificateSelected)

	const handleBrowseCertificate = useCallback(() => {
		const requestId =
			typeof crypto !== "undefined" && "randomUUID" in crypto
				? crypto.randomUUID()
				: `ssl-cert-${Date.now()}-${Math.random()}`

		pendingCertificateRequestId.current = requestId
		vscode.postMessage({ type: "selectSslCertificate", requestId })
	}, [])

	const handleClearCertificate = useCallback(() => {
		setApiConfigurationField("sslCertificateUri", undefined)
		setApiConfigurationField("sslCertificateDisplayPath", undefined)
	}, [setApiConfigurationField])

	return (
		<div className="flex flex-col gap-2" data-testid="ssl-verification-setting">
			<label className="block font-medium mb-1">{t("settings:providers.sslVerification")}</label>
			<Select
				value={sslVerificationEnabled ? "true" : "false"}
				onValueChange={(selectedValue) => {
					const value = selectedValue === "true"
					setApiConfigurationField("sslVerificationEnabled", value)
				}}>
				<SelectTrigger className="w-full" data-testid="ssl-verification-dropdown">
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="true">True</SelectItem>
					<SelectItem value="false">False</SelectItem>
				</SelectContent>
			</Select>
			{!sslVerificationEnabled && (
				<div className="text-sm text-vscode-warningForeground" data-testid="ssl-verification-warning">
					{t("settings:providers.sslVerificationWarning")}
				</div>
			)}
			{sslVerificationEnabled && (
				<div className="flex flex-col gap-2" data-testid="ssl-certificate-setting">
					<label className="block font-medium mb-1">{t("settings:providers.sslCertificate")}</label>
					<div className="flex gap-2">
						<VSCodeTextField
							value={apiConfiguration.sslCertificateDisplayPath || ""}
							readOnly
							placeholder={t("settings:providers.sslCertificatePlaceholder")}
							className="w-full"
							data-testid="ssl-certificate-path"
						/>
						<Button
							variant="secondary"
							onClick={handleBrowseCertificate}
							data-testid="ssl-certificate-browse">
							{t("settings:providers.browse")}
						</Button>
						<Button
							variant="secondary"
							onClick={handleClearCertificate}
							disabled={!apiConfiguration.sslCertificateUri}
							data-testid="ssl-certificate-clear">
							{t("settings:providers.clear")}
						</Button>
					</div>
				</div>
			)}
		</div>
	)
}
