# Contributing

Use Node.js 24.5+ and npm. Run `npm ci`, then `npm run dev`. Before submitting a change, run `npm test` and `npm run build`.

Keep simulation state separate from rendering. A graph point or important number should come from the universe, not from random draws in a paint function. Use the seeded provider for simulation randomness and bound every collection.

Persistence changes need round-trip, migration, corruption, and elapsed-time tests. Preserve snapshots from newer versions. Add a fixture before changing a schema, and document whether simulation trajectories change.

For UI changes, check a narrow screen, keyboard navigation, reduced motion, fullscreen, and at least two themes. Keep sound opt-in. Do not add analytics, remote fonts, private-data access, or network-backed simulation.

Describe the problem, resulting behavior, and validation in your pull request. Small changes are easier to review. Contributions are accepted under the project's MIT License; retain existing third-party notices.
