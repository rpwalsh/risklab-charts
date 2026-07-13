# Security policy

Report suspected vulnerabilities privately through the repository security advisory interface. Do not include sensitive data in public issues.

Supported releases receive fixes on the current major line. Security issues include injection, unsafe parsing or serialization, prototype pollution, dependency vulnerabilities, resource exhaustion, and data-boundary failures.

Chart configuration and formatter callbacks are application code. Text formatters are escaped by default; explicitly unsafe HTML rendering must only receive sanitized, trusted output.
