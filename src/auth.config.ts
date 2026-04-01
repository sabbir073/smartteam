import type { NextAuthConfig } from "next-auth";

export const authConfig: NextAuthConfig = {
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnDashboard = !nextUrl.pathname.startsWith("/login");

      if (isOnDashboard) {
        if (isLoggedIn) return true;
        return false; // Redirect to login
      } else if (isLoggedIn) {
        return Response.redirect(new URL("/", nextUrl));
      }

      return true;
    },
    jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id as string;
        token.email = (user.email ?? "") as string;
        token.name = (user.name ?? "") as string;
        token.roleId = (user as unknown as Record<string, unknown>).roleId as string;
        token.roleName = (user as unknown as Record<string, unknown>).roleName as string;
        token.roleLevel = (user as unknown as Record<string, unknown>).roleLevel as number;
      }
      // Handle session updates (e.g., name change from profile page)
      if (trigger === "update" && session) {
        if (session.name) token.name = session.name;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id as string;
      session.user.email = token.email as string;
      session.user.name = token.name as string;
      session.user.roleId = token.roleId as string;
      session.user.roleName = token.roleName as string;
      session.user.roleLevel = token.roleLevel as number;
      return session;
    },
  },
  providers: [],
};
