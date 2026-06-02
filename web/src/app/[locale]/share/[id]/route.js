import { NextResponse } from 'next/server';

export async function GET(request, { params }) {
  const { id } = await params;
  const url = new URL(request.url);
  return NextResponse.redirect(
    `https://app.treklist.co/share/${id}${url.search}`,
    { status: 301 }
  );
}
