import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { loginUser, fetchMe, updatePublicKey, backupKey } from "../api/auth";
import { useAuth } from "../auth/AuthContext";
import { generateKeyPair, decryptPrivateKeyWithPassword, encryptPrivateKeyWithPassword } from "../utils/crypto";
import { getMyPrivateKey, saveMyPrivateKey } from "../db/localDb";

type ApiError = {
  response?: {
    data?: {
      message?: string;
    };
  };
};

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const { token, encryptedPrivateKey } = await loginUser(email, password, undefined);
      localStorage.setItem("token", token);
      const user = await fetchMe();

      let localPrivateKey = await getMyPrivateKey(user.id);

      if (encryptedPrivateKey) {
        // Cross-device login! Decrypt the backed-up private key using the plaintext password
        try {
          const decryptedKey = await decryptPrivateKeyWithPassword(encryptedPrivateKey, password, email);
          await saveMyPrivateKey(user.id, decryptedKey);
          console.log("Successfully restored private key from server backup!");
        } catch (decryptErr) {
          console.error("Failed to decrypt private key backup. Password might be wrong or data corrupted.", decryptErr);
          throw new Error("Failed to decrypt your encryption key. Check your password.");
        }
      } else if (localPrivateKey) {
        // Progressive Migration: User has an existing key locally but no server backup yet
        console.log("Backing up local private key to server for cross-device support...");
        const newEncryptedKey = await encryptPrivateKeyWithPassword(localPrivateKey, password, email);
        await backupKey(newEncryptedKey);
      } else {
        // Fallback for legacy accounts with no key on this device and no server backup
        console.warn("No keys found anywhere! Generating a brand new keypair (History will be unreadable)");
        const keyPair = await generateKeyPair();
        await saveMyPrivateKey(user.id, keyPair.privateKey);
        await updatePublicKey(keyPair.publicKeyBase64);
        const newEncryptedKey = await encryptPrivateKeyWithPassword(keyPair.privateKey, password, email);
        await backupKey(newEncryptedKey);
      }

      login(token, user);
      navigate("/");
    } catch (err: unknown) {
      const apiError = err as ApiError;
      setError(apiError.response?.data?.message || "Login failed");
      localStorage.removeItem("token");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-form">
        <h2>Welcome Back</h2>

        {error && <div className="error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              placeholder="Your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" disabled={loading}>
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>

        <div className="footer">
          No account? <Link to="/register">Register here</Link>
        </div>
      </div>
    </div>
  );
};

export default Login;
