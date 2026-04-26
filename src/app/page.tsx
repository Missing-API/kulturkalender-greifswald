export default function HomePage() {
  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: "2rem", maxWidth: "640px" }}>
      <h1>Kulturkalender Greifswald API</h1>
      <p>
        Event data from{" "}
        <a href="https://www.kulturkalender.greifswald.de">
          Kulturkalender Greifswald
        </a>{" "}
        delivered as JSON and ICS.
      </p>

      <h2>Endpoints</h2>
      <ul>
        <li>
          <a href="/api/v1/events">GET /api/v1/events</a> &mdash; JSON event list
        </li>
        <li>
          <a href="/api/v1/events.ics">GET /api/v1/events.ics</a> &mdash; ICS calendar feed
        </li>
      </ul>

      <h2>Documentation</h2>
      <ul>
        <li>
          <a href="/api/docs">Swagger UI</a>
        </li>
        <li>
          <a href="/api/docs/openapi.json">OpenAPI JSON</a>
        </li>
      </ul>
    </main>
  );
}
