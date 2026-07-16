# Coverage policy

`npm run test:coverage` enforces at least 80% statement, function, and line coverage on the deterministic chart, scale, data, theme, SDK, boost, and core data-processing modules. Branch coverage is gated at 70% to retain explicit fallbacks for sparse data, browser capabilities, and accessibility behavior.

DOM renderers, interaction plugins, animation loops, framework adapters, and GPU scenes are verified through the Chromium render/resize/pointer/export/destroy lifecycle suite, adapter package tests, type checks, and installed-tarball smoke tests. They are not misrepresented as jsdom unit coverage.
