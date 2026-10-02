import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export const VISITOR_COOKIE = "cyphor_visitor";

export function proxy(request: NextRequest) {
  const response = NextResponse.next();

  if (!request.cookies.get(VISITOR_COOKIE)) {
    response.cookies.set(VISITOR_COOKIE, crypto.randomUUID(), {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365, // 1 year
    });
  }

  return response;
}

export const config = {
  matcher: ["/", "/api/:path*"],
};
