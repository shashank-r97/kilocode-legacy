import React from "react"
import { render, screen, fireEvent } from "@/utils/test-utils"
import { OpenAICompatible } from "../OpenAICompatible"
import { ProviderSettings } from "@roo-code/types"
import { useEvent } from "react-use"

const vscodeMocks = vi.hoisted(() => ({
	postMessage: vi.fn(),
}))

// Mock the vscrui Checkbox component
vi.mock("vscrui", () => ({
	Checkbox: ({ children, checked, onChange }: any) => (
		<label data-testid={`checkbox-${children?.toString().replace(/\s+/g, "-").toLowerCase()}`}>
			<input
				type="checkbox"
				checked={checked}
				onChange={() => onChange(!checked)} // Toggle the checked state
				data-testid={`checkbox-input-${children?.toString().replace(/\s+/g, "-").toLowerCase()}`}
			/>
			{children}
		</label>
	),
}))

// Mock the VSCodeTextField and VSCodeButton components
vi.mock("@vscode/webview-ui-toolkit/react", () => ({
	VSCodeTextField: ({
		children,
		value,
		onInput,
		placeholder,
		className,
		style,
		"data-testid": dataTestId,
		...rest
	}: any) => {
		return (
			<div
				data-testid={dataTestId ? `${dataTestId}-text-field` : "vscode-text-field"}
				className={className}
				style={style}>
				{children}
				<input
					type="text"
					value={value}
					onChange={(e) => onInput && onInput(e)}
					placeholder={placeholder}
					data-testid={dataTestId}
					{...rest}
				/>
			</div>
		)
	},
	VSCodeButton: ({ children, onClick, appearance, title }: any) => (
		<button onClick={onClick} title={title} data-testid={`vscode-button-${appearance}`}>
			{children}
		</button>
	),
	VSCodeDropdown: ({ children, value, onChange, "data-testid": dataTestId, className }: any) => (
		<select value={value} onChange={onChange} data-testid={dataTestId} className={className}>
			{children}
		</select>
	),
	VSCodeOption: ({ children, value }: any) => <option value={value}>{children}</option>,
}))

// Mock the translation hook
vi.mock("@src/i18n/TranslationContext", () => ({
	useAppTranslation: () => ({
		t: (key: string) => key,
	}),
}))

vi.mock("@src/utils/vscode", () => ({
	vscode: {
		postMessage: vscodeMocks.postMessage,
	},
}))

// Mock the UI components
vi.mock("@src/components/ui", () => ({
	Button: ({ children, onClick, ...rest }: any) => (
		<button onClick={onClick} {...rest}>
			{children}
		</button>
	),
	Select: ({ children, value, onValueChange }: any) => (
		<select value={value} onChange={(e) => onValueChange?.(e.target.value)} data-testid="ssl-verification-dropdown">
			{children}
		</select>
	),
	SelectContent: ({ children }: any) => <>{children}</>,
	SelectItem: ({ children, value }: any) => <option value={value}>{children}</option>,
	SelectTrigger: () => null,
	SelectValue: () => null,
	StandardTooltip: ({ children, content }: any) => <div title={content}>{children}</div>,
}))

// Mock other components
vi.mock("../../ModelPicker", () => ({
	ModelPicker: () => <div data-testid="model-picker">Model Picker</div>,
}))

vi.mock("../../R1FormatSetting", () => ({
	R1FormatSetting: () => <div data-testid="r1-format-setting">R1 Format Setting</div>,
}))

vi.mock("../../ThinkingBudget", () => ({
	ThinkingBudget: () => <div data-testid="thinking-budget">Thinking Budget</div>,
}))

// Mock react-use
vi.mock("react-use", () => ({
	useEvent: vi.fn(),
}))

describe("OpenAICompatible Component - includeMaxTokens checkbox", () => {
	const mockSetApiConfigurationField = vi.fn()
	const mockOrganizationAllowList = {
		allowAll: true,
		providers: {},
	}
	const useEventListeners: Array<{ eventName: string; handler: EventListener }> = []

	beforeEach(() => {
		vi.clearAllMocks()
		vi.mocked(useEvent).mockImplementation((eventName, handler) => {
			if (!handler) {
				return
			}

			const eventListenerName = eventName as string
			const eventListener = handler as EventListener

			window.addEventListener(eventListenerName, eventListener)
			useEventListeners.push({ eventName: eventListenerName, handler: eventListener })
		})
	})

	afterEach(() => {
		for (const { eventName, handler } of useEventListeners) {
			window.removeEventListener(eventName, handler)
		}

		useEventListeners.length = 0
	})

	describe("Checkbox Rendering", () => {
		it("should render the includeMaxTokens checkbox", () => {
			const apiConfiguration: Partial<ProviderSettings> = {
				includeMaxTokens: true,
			}

			render(
				<OpenAICompatible
					apiConfiguration={apiConfiguration as ProviderSettings}
					setApiConfigurationField={mockSetApiConfigurationField}
					organizationAllowList={mockOrganizationAllowList}
				/>,
			)

			// Check that the checkbox is rendered
			const checkbox = screen.getByTestId("checkbox-settings:includemaxoutputtokens")
			expect(checkbox).toBeInTheDocument()

			// Check that the description text is rendered
			expect(screen.getByText("settings:includeMaxOutputTokensDescription")).toBeInTheDocument()
		})

		it("should render the checkbox with correct translation keys", () => {
			const apiConfiguration: Partial<ProviderSettings> = {
				includeMaxTokens: true,
			}

			render(
				<OpenAICompatible
					apiConfiguration={apiConfiguration as ProviderSettings}
					setApiConfigurationField={mockSetApiConfigurationField}
					organizationAllowList={mockOrganizationAllowList}
				/>,
			)

			// Check that the correct translation key is used for the label
			expect(screen.getByText("settings:includeMaxOutputTokens")).toBeInTheDocument()

			// Check that the correct translation key is used for the description
			expect(screen.getByText("settings:includeMaxOutputTokensDescription")).toBeInTheDocument()
		})
	})

	describe("Initial State", () => {
		it("should show checkbox as checked when includeMaxTokens is true", () => {
			const apiConfiguration: Partial<ProviderSettings> = {
				includeMaxTokens: true,
			}

			render(
				<OpenAICompatible
					apiConfiguration={apiConfiguration as ProviderSettings}
					setApiConfigurationField={mockSetApiConfigurationField}
					organizationAllowList={mockOrganizationAllowList}
				/>,
			)

			const checkboxInput = screen.getByTestId("checkbox-input-settings:includemaxoutputtokens")
			expect(checkboxInput).toBeChecked()
		})

		it("should show checkbox as unchecked when includeMaxTokens is false", () => {
			const apiConfiguration: Partial<ProviderSettings> = {
				includeMaxTokens: false,
			}

			render(
				<OpenAICompatible
					apiConfiguration={apiConfiguration as ProviderSettings}
					setApiConfigurationField={mockSetApiConfigurationField}
					organizationAllowList={mockOrganizationAllowList}
				/>,
			)

			const checkboxInput = screen.getByTestId("checkbox-input-settings:includemaxoutputtokens")
			expect(checkboxInput).not.toBeChecked()
		})

		it("should default to checked when includeMaxTokens is undefined", () => {
			const apiConfiguration: Partial<ProviderSettings> = {
				// includeMaxTokens is not defined
			}

			render(
				<OpenAICompatible
					apiConfiguration={apiConfiguration as ProviderSettings}
					setApiConfigurationField={mockSetApiConfigurationField}
					organizationAllowList={mockOrganizationAllowList}
				/>,
			)

			const checkboxInput = screen.getByTestId("checkbox-input-settings:includemaxoutputtokens")
			expect(checkboxInput).toBeChecked()
		})

		it("should default to checked when includeMaxTokens is null", () => {
			const apiConfiguration: Partial<ProviderSettings> = {
				includeMaxTokens: null as any,
			}

			render(
				<OpenAICompatible
					apiConfiguration={apiConfiguration as ProviderSettings}
					setApiConfigurationField={mockSetApiConfigurationField}
					organizationAllowList={mockOrganizationAllowList}
				/>,
			)

			const checkboxInput = screen.getByTestId("checkbox-input-settings:includemaxoutputtokens")
			expect(checkboxInput).toBeChecked()
		})
	})

	describe("User Interaction", () => {
		it("should call handleInputChange with correct parameters when checkbox is clicked from checked to unchecked", () => {
			const apiConfiguration: Partial<ProviderSettings> = {
				includeMaxTokens: true,
			}

			render(
				<OpenAICompatible
					apiConfiguration={apiConfiguration as ProviderSettings}
					setApiConfigurationField={mockSetApiConfigurationField}
					organizationAllowList={mockOrganizationAllowList}
				/>,
			)

			const checkboxInput = screen.getByTestId("checkbox-input-settings:includemaxoutputtokens")
			fireEvent.click(checkboxInput)

			// Verify setApiConfigurationField was called with correct parameters
			expect(mockSetApiConfigurationField).toHaveBeenCalledWith("includeMaxTokens", false)
		})

		it("should call handleInputChange with correct parameters when checkbox is clicked from unchecked to checked", () => {
			const apiConfiguration: Partial<ProviderSettings> = {
				includeMaxTokens: false,
			}

			render(
				<OpenAICompatible
					apiConfiguration={apiConfiguration as ProviderSettings}
					setApiConfigurationField={mockSetApiConfigurationField}
					organizationAllowList={mockOrganizationAllowList}
				/>,
			)

			const checkboxInput = screen.getByTestId("checkbox-input-settings:includemaxoutputtokens")
			fireEvent.click(checkboxInput)

			// Verify setApiConfigurationField was called with correct parameters
			expect(mockSetApiConfigurationField).toHaveBeenCalledWith("includeMaxTokens", true)
		})
	})

	describe("Component Updates", () => {
		it("should update checkbox state when apiConfiguration changes", () => {
			const apiConfigurationInitial: Partial<ProviderSettings> = {
				includeMaxTokens: true,
			}

			const { rerender } = render(
				<OpenAICompatible
					apiConfiguration={apiConfigurationInitial as ProviderSettings}
					setApiConfigurationField={mockSetApiConfigurationField}
					organizationAllowList={mockOrganizationAllowList}
				/>,
			)

			// Verify initial state
			let checkboxInput = screen.getByTestId("checkbox-input-settings:includemaxoutputtokens")
			expect(checkboxInput).toBeChecked()

			// Update with new configuration
			const apiConfigurationUpdated: Partial<ProviderSettings> = {
				includeMaxTokens: false,
			}

			rerender(
				<OpenAICompatible
					apiConfiguration={apiConfigurationUpdated as ProviderSettings}
					setApiConfigurationField={mockSetApiConfigurationField}
					organizationAllowList={mockOrganizationAllowList}
				/>,
			)

			// Verify updated state
			checkboxInput = screen.getByTestId("checkbox-input-settings:includemaxoutputtokens")
			expect(checkboxInput).not.toBeChecked()
		})
	})

	describe("UI Structure", () => {
		it("should render SSL verification below API key and above model picker", () => {
			const apiConfiguration: Partial<ProviderSettings> = {
				openAiBaseUrl: "https://llm.local/v1",
				openAiApiKey: "test-key",
			}

			render(
				<OpenAICompatible
					apiConfiguration={apiConfiguration as ProviderSettings}
					setApiConfigurationField={mockSetApiConfigurationField}
					organizationAllowList={mockOrganizationAllowList}
				/>,
			)

			const apiKeyLabel = screen.getByText("settings:providers.apiKey")
			const sslSetting = screen.getByTestId("ssl-verification-setting")
			const modelPicker = screen.getByTestId("model-picker")

			expect(apiKeyLabel.compareDocumentPosition(sslSetting) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
			expect(sslSetting.compareDocumentPosition(modelPicker) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
		})

		it("should default SSL verification to false and show the process-wide warning", () => {
			const apiConfiguration: Partial<ProviderSettings> = {
				openAiBaseUrl: "https://llm.local/v1",
			}

			render(
				<OpenAICompatible
					apiConfiguration={apiConfiguration as ProviderSettings}
					setApiConfigurationField={mockSetApiConfigurationField}
					organizationAllowList={mockOrganizationAllowList}
				/>,
			)

			expect(screen.getByTestId("ssl-verification-dropdown")).toHaveValue("false")
			expect(screen.getByTestId("ssl-verification-warning")).toHaveTextContent(
				"settings:providers.sslVerificationWarning",
			)
		})

		it("should update SSL verification when dropdown changes", () => {
			const apiConfiguration: Partial<ProviderSettings> = {
				openAiBaseUrl: "https://llm.local/v1",
				sslVerificationEnabled: false,
			}

			render(
				<OpenAICompatible
					apiConfiguration={apiConfiguration as ProviderSettings}
					setApiConfigurationField={mockSetApiConfigurationField}
					organizationAllowList={mockOrganizationAllowList}
				/>,
			)

			fireEvent.change(screen.getByTestId("ssl-verification-dropdown"), { target: { value: "true" } })

			expect(mockSetApiConfigurationField).toHaveBeenCalledWith("sslVerificationEnabled", true)
		})

		it("should show custom CA certificate controls only when SSL verification is true", () => {
			const { rerender } = render(
				<OpenAICompatible
					apiConfiguration={
						{ openAiBaseUrl: "https://llm.local/v1", sslVerificationEnabled: false } as ProviderSettings
					}
					setApiConfigurationField={mockSetApiConfigurationField}
					organizationAllowList={mockOrganizationAllowList}
				/>,
			)

			expect(screen.queryByTestId("ssl-certificate-setting")).not.toBeInTheDocument()

			rerender(
				<OpenAICompatible
					apiConfiguration={
						{ openAiBaseUrl: "https://llm.local/v1", sslVerificationEnabled: true } as ProviderSettings
					}
					setApiConfigurationField={mockSetApiConfigurationField}
					organizationAllowList={mockOrganizationAllowList}
				/>,
			)

			expect(screen.getByTestId("ssl-certificate-setting")).toBeInTheDocument()
			expect(screen.queryByTestId("ssl-verification-warning")).not.toBeInTheDocument()
		})

		it("should request and store a selected custom CA certificate", () => {
			render(
				<OpenAICompatible
					apiConfiguration={
						{ openAiBaseUrl: "https://llm.local/v1", sslVerificationEnabled: true } as ProviderSettings
					}
					setApiConfigurationField={mockSetApiConfigurationField}
					organizationAllowList={mockOrganizationAllowList}
				/>,
			)

			fireEvent.click(screen.getByTestId("ssl-certificate-browse"))

			const request = vscodeMocks.postMessage.mock.calls[0][0]
			expect(request.type).toBe("selectSslCertificate")
			expect(request.requestId).toBeTruthy()

			window.dispatchEvent(
				new MessageEvent("message", {
					data: {
						type: "sslCertificateSelected",
						requestId: request.requestId,
						uri: "vscode-remote://ssh-remote+host/etc/ssl/custom.pem",
						displayPath: "/etc/ssl/custom.pem",
					},
				}),
			)

			expect(mockSetApiConfigurationField).toHaveBeenCalledWith(
				"sslCertificateUri",
				"vscode-remote://ssh-remote+host/etc/ssl/custom.pem",
			)
			expect(mockSetApiConfigurationField).toHaveBeenCalledWith(
				"sslCertificateDisplayPath",
				"/etc/ssl/custom.pem",
			)
		})

		it("should clear the selected custom CA certificate without disabling SSL verification", () => {
			render(
				<OpenAICompatible
					apiConfiguration={
						{
							openAiBaseUrl: "https://llm.local/v1",
							sslVerificationEnabled: true,
							sslCertificateUri: "file:///C:/certs/custom.pem",
							sslCertificateDisplayPath: "C:\\certs\\custom.pem",
						} as ProviderSettings
					}
					setApiConfigurationField={mockSetApiConfigurationField}
					organizationAllowList={mockOrganizationAllowList}
				/>,
			)

			fireEvent.click(screen.getByTestId("ssl-certificate-clear"))

			expect(mockSetApiConfigurationField).toHaveBeenCalledWith("sslCertificateUri", undefined)
			expect(mockSetApiConfigurationField).toHaveBeenCalledWith("sslCertificateDisplayPath", undefined)
			expect(mockSetApiConfigurationField).not.toHaveBeenCalledWith("sslVerificationEnabled", false)
		})

		it("should render the checkbox with description in correct structure", () => {
			const apiConfiguration: Partial<ProviderSettings> = {
				includeMaxTokens: true,
			}

			render(
				<OpenAICompatible
					apiConfiguration={apiConfiguration as ProviderSettings}
					setApiConfigurationField={mockSetApiConfigurationField}
					organizationAllowList={mockOrganizationAllowList}
				/>,
			)

			// Check that the checkbox and description are in a div container
			const checkbox = screen.getByTestId("checkbox-settings:includemaxoutputtokens")
			const parentDiv = checkbox.closest("div")
			expect(parentDiv).toBeInTheDocument()

			// Check that the description has the correct styling classes
			const description = screen.getByText("settings:includeMaxOutputTokensDescription")
			expect(description).toHaveClass("text-sm", "text-vscode-descriptionForeground", "ml-6")
		})
	})
})
