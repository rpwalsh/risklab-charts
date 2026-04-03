# Security Policy

## Supported versions

RiskLab Charts currently supports the latest `1.x` line.

| Version | Supported |
| --- | --- |
| `1.x` | Yes |

## Reporting

If you find a security issue, do not open a public issue.

Report privately through GitHub Security Advisories for this repository.

Include:

- affected package and version
- impact summary
- reproduction details
- suggested mitigation if available

## Response targets

- Initial triage: within 3 business days
- Status update cadence: at least weekly until resolution
- Patch release target: based on severity and exploitability

## Scope

Security issues include:

- prototype pollution
- code injection
- unsafe serialization or parsing paths
- privilege or data boundary bypass
- dependency-level vulnerabilities in shipped artifacts
  themeToCSSVars as themeToCSSVarsFromAdapter,
} from '../adapters/stylex/StyleXAdapter';

/**
 * Generate CSS custom properties from a RiskLab chart theme.
 *
 * This surface is framework-agnostic and intended for design-system
 * integrations that want chart tokens available in plain CSS, Tailwind,
 * CSS Modules, or other styling layers.
 */
export function themeToCSSVars(theme: ThemeConfig, prefix = '--uc'): Record<string, string> {
  return themeToCSSVarsFromAdapter(theme, prefix);
}

/**
 * Apply a RiskLab chart theme directly to a DOM element as CSS variables.
 */
export function applyThemeCSSVars(
  element: HTMLElement,
  theme: ThemeConfig,
  prefix = '--uc',
): void {
  applyThemeCSSVarsFromAdapter(element, theme, prefix);
}
