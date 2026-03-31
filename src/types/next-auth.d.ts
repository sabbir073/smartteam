import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      image?: string | null;
      roleId: string;
      roleName: string;
      roleLevel: number;
    };
  }

  interface User {
    id: string;
    email: string;
    name: string;
    roleId: string;
    roleName: string;
    roleLevel: number;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    email: string;
    name: string;
    roleId: string;
    roleName: string;
    roleLevel: number;
  }
}
