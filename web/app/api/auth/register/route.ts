import { NextResponse } from "next/server";
import { registerUser, sendVerificationEmail, verificationUrl } from "../../../../lib/server/auth";
import { toErrorResponse } from "../../../../lib/server/errors";
import { getOrCreateProfile } from "../../../../lib/server/profile";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { email?: string; password?: string };
    const { user, verification } = await registerUser(body.email ?? "", body.password ?? "");
    await getOrCreateProfile(user);
    const url = verificationUrl(verification.token);
    const sent = await sendVerificationEmail(user.email, url);
    if (sent) {
      return NextResponse.json({ message: "確認メールを送りました。届いたリンクを開いてください。" });
    }
    return NextResponse.json({
      message: "確認メールの送信設定が無いので、下のリンクを開いて確認してください。",
      verification_url: url,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
