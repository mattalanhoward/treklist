import { NextResponse } from 'next/server';

export function GET(request, { params }) {
  const url = new URL(request.url);
  return NextResponse.redirect(
    `https://app.treklist.co/share/${params.id}${url.search}`,
    { status: 302 }
  );
}
