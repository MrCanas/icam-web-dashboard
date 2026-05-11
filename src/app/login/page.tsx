import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { LoginForm } from "@/app/login/LoginForm";

export default async function LoginPage() {
  const cookieStore = await cookies();
  const authCookie = cookieStore.get("icam-auth");

  if (authCookie?.value === "authenticated") {
    redirect("/dashboard/portfolio");
  }

  return <LoginForm />;
}
