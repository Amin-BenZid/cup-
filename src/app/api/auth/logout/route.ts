import { NextResponse } from "next/server";
import { SHOP_COOKIE } from "@/lib/shop-auth";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set({
    name: SHOP_COOKIE,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
  return res;
}