import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "lemigas_session";

// Melindungi /dashboard dan mengarahkan pengguna yang sudah login keluar dari /login.
export function middleware(req: NextRequest) {
  const hasSession = Boolean(req.cookies.get(SESSION_COOKIE)?.value);
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/dashboard") && !hasSession) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  if (pathname === "/login" && hasSession) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ["/dashboard/:path*", "/login"] };
