import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { authConfig } from "./auth.config";
import { supabase } from "./lib/db";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const email = credentials.email as string;
        const password = credentials.password as string;

        // Fetch user from database
        const { data: user, error } = await supabase
          .from("users")
          .select("*")
          .eq("email", email)
          .eq("is_active", true)
          .single();

        if (error || !user) {
          return null;
        }

        // Verify password
        const isValidPassword = await bcrypt.compare(password, user.password_hash);
        if (!isValidPassword) {
          return null;
        }

        // Fetch user role
        const { data: userRole } = await supabase
          .from("user_roles")
          .select(`
            role_id,
            roles:role_id (
              id,
              name,
              level
            )
          `)
          .eq("user_id", user.id)
          .single();

        const roleData = userRole?.roles as unknown;
        const role = (Array.isArray(roleData) ? roleData[0] : roleData) as { id: string; name: string; level: number } | null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.avatar_url,
          roleId: role?.id || "",
          roleName: role?.name || "",
          roleLevel: role?.level ?? 999,
        };
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
});
