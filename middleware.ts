import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "lemigas_session";

function sessionHome(value?: string) {
  if (!value) return "/dashboard";
  try {
    const session = JSON.parse(decodeURIComponent(value));
    return String(session?.user?.role ?? "")
      .toLowerCase()
      .includes("vendor")
      ? "/dashboard/vendor-portal"
      : "/dashboard";
  } catch {
    return "/dashboard";
  }
}

// Protect dashboard routes and send vendor accounts to their portal.
export function middleware(req: NextRequest) {
  const sessionValue = req.cookies.get(SESSION_COOKIE)?.value;
  const hasSession = Boolean(sessionValue);
  const { pathname } = req.nextUrl;
  const home = sessionHome(sessionValue);

  if (pathname.startsWith("/dashboard") && !hasSession) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  if (hasSession && home !== "/dashboard") {
    const isVendorPortal = pathname === "/dashboard/vendor-portal" || pathname.startsWith("/dashboard/vendor-portal/");
    if (pathname === "/dashboard" || (pathname.startsWith("/dashboard/") && !isVendorPortal)) {
      return NextResponse.redirect(new URL(home, req.url));
    }
  }
  if (pathname === "/login" && hasSession) {
    return NextResponse.redirect(new URL(home, req.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ["/dashboard/:path*", "/login"] };
