import type { Metadata } from "next";
import { SignupForm } from "./signup-form";

export const metadata: Metadata = { title: "Create account", description: "Create a free feelfreedoc account to keep your processing history." };

export default function SignupPage() {
  return <SignupForm />;
}
