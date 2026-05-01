import { useEffect } from "react";
import Header from "../components/Header";
import { useAuth } from "../context/AuthContext";

export default function ProfilePage() {
  const { user, login } = useAuth();

  useEffect(() => {
    if (user && !user.isRegistered) {
      login({
        ...user,
        isRegistered: true,
      });
    }
  }, [user, login]);

  return (
    <>
      <Header />

      <div style={{ padding: 40 }}>
        <h1>Profile</h1>

        {user && (
          <div style={{ marginTop: 16 }}>
            <p><strong>Name:</strong> {user.displayName}</p>
            <p><strong>Registered:</strong> yes</p>
          </div>
        )}
      </div>
    </>
  );
}