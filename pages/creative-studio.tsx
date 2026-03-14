// pages/creative-studio.tsx
// Redirect to Brand Studio (renamed from Creative Studio)

import type { GetServerSideProps } from "next";

export const getServerSideProps: GetServerSideProps = async () => {
  return {
    redirect: {
      destination: "/brand-studio",
      permanent: true,
    },
  };
};

export default function CreativeStudioRedirect() {
  return null;
}
