/* eslint-disable @schafevormfenster/enforce-semantic-cache-headers -- Cache-Control set via NextResponse constructor options */
/* eslint-disable @schafevormfenster/enforce-api-route-structure -- OpenAPI spec route is infra, not a business API */
import { NextResponse } from "next/server";

import { generateOpenApiSpec } from "@/services/shared/openapi/openapi-spec";

export async function GET() {
  const spec = generateOpenApiSpec();
  return NextResponse.json(spec, {
    headers: {
      "Cache-Control": "public, s-maxage=86400",
    },
  });
}
