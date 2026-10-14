import type { Metadata } from "next";
import { cookies } from "next/headers";
import { SESSION_COOKIE, userFromIdentity } from "@/lib/auth";

export const metadata: Metadata = { title: "Profil" };

export default function ProfilPage() {
  const user = userFromIdentity(cookies().get(SESSION_COOKIE)?.value);
  return (
    <section className="section page-top">
      <h1 className="page-title">Profil</h1>
      <div className="panel profile">
        <span className="avatar lg">{user.initials}</span>
        <dl>
          <div>
            <dt>Nama</dt>
            <dd>{user.name}</dd>
          </div>
          <div>
            <dt>Peran</dt>
            <dd>{user.role}</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>{user.email || "Belum diisi"}</dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
