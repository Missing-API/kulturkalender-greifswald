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
