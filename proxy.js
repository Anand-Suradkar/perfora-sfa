
import { NextResponse } from "next/server";

export function proxy(request) {
  const { pathname } = request.nextUrl;

  // Allow the notice page.
  if (pathname === "/") {
    return NextResponse.next();
  }

  // Send every other application route to the notice page.
  return NextResponse.redirect(new URL("/", request.url), 307);
}

export const config = {
  matcher: [
    "/((?!_next/|favicon.ico|.*\\..*).*)",
  ],
};
