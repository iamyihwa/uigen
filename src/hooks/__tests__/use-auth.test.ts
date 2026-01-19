import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useAuth } from "@/hooks/use-auth";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

const mockSignIn = vi.fn();
const mockSignUp = vi.fn();
vi.mock("@/actions", () => ({
  signIn: (...args: unknown[]) => mockSignIn(...args),
  signUp: (...args: unknown[]) => mockSignUp(...args),
}));

const mockGetAnonWorkData = vi.fn();
const mockClearAnonWork = vi.fn();
vi.mock("@/lib/anon-work-tracker", () => ({
  getAnonWorkData: () => mockGetAnonWorkData(),
  clearAnonWork: () => mockClearAnonWork(),
}));

const mockGetProjects = vi.fn();
vi.mock("@/actions/get-projects", () => ({
  getProjects: () => mockGetProjects(),
}));

const mockCreateProject = vi.fn();
vi.mock("@/actions/create-project", () => ({
  createProject: (...args: unknown[]) => mockCreateProject(...args),
}));

describe("useAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAnonWorkData.mockReturnValue(null);
    mockGetProjects.mockResolvedValue([]);
    mockCreateProject.mockResolvedValue({ id: "new-project-id" });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("initial state", () => {
    it("should return isLoading as false initially", () => {
      const { result } = renderHook(() => useAuth());
      expect(result.current.isLoading).toBe(false);
    });

    it("should return signIn and signUp functions", () => {
      const { result } = renderHook(() => useAuth());
      expect(typeof result.current.signIn).toBe("function");
      expect(typeof result.current.signUp).toBe("function");
    });
  });

  describe("signIn", () => {
    describe("happy path", () => {
      it("should call signInAction with email and password", async () => {
        mockSignIn.mockResolvedValue({ success: true });

        const { result } = renderHook(() => useAuth());

        await act(async () => {
          await result.current.signIn("test@example.com", "password123");
        });

        expect(mockSignIn).toHaveBeenCalledWith(
          "test@example.com",
          "password123"
        );
      });

      it("should return the result from signInAction", async () => {
        mockSignIn.mockResolvedValue({ success: true });

        const { result } = renderHook(() => useAuth());

        let signInResult;
        await act(async () => {
          signInResult = await result.current.signIn(
            "test@example.com",
            "password123"
          );
        });

        expect(signInResult).toEqual({ success: true });
      });

      it("should redirect to existing project after successful sign in", async () => {
        mockSignIn.mockResolvedValue({ success: true });
        mockGetProjects.mockResolvedValue([
          { id: "existing-project-id", name: "Project 1" },
        ]);

        const { result } = renderHook(() => useAuth());

        await act(async () => {
          await result.current.signIn("test@example.com", "password123");
        });

        expect(mockPush).toHaveBeenCalledWith("/existing-project-id");
      });

      it("should create new project if no projects exist", async () => {
        mockSignIn.mockResolvedValue({ success: true });
        mockGetProjects.mockResolvedValue([]);
        mockCreateProject.mockResolvedValue({ id: "new-project-id" });

        const { result } = renderHook(() => useAuth());

        await act(async () => {
          await result.current.signIn("test@example.com", "password123");
        });

        expect(mockCreateProject).toHaveBeenCalledWith(
          expect.objectContaining({
            messages: [],
            data: {},
          })
        );
        expect(mockPush).toHaveBeenCalledWith("/new-project-id");
      });
    });

    describe("with anonymous work", () => {
      it("should save anonymous work to a new project after sign in", async () => {
        const anonWorkData = {
          messages: [{ role: "user", content: "Hello" }],
          fileSystemData: { "/App.jsx": "content" },
        };
        mockGetAnonWorkData.mockReturnValue(anonWorkData);
        mockSignIn.mockResolvedValue({ success: true });
        mockCreateProject.mockResolvedValue({ id: "anon-project-id" });

        const { result } = renderHook(() => useAuth());

        await act(async () => {
          await result.current.signIn("test@example.com", "password123");
        });

        expect(mockCreateProject).toHaveBeenCalledWith(
          expect.objectContaining({
            messages: anonWorkData.messages,
            data: anonWorkData.fileSystemData,
          })
        );
        expect(mockClearAnonWork).toHaveBeenCalled();
        expect(mockPush).toHaveBeenCalledWith("/anon-project-id");
      });

      it("should ignore anonymous work with empty messages", async () => {
        mockGetAnonWorkData.mockReturnValue({
          messages: [],
          fileSystemData: {},
        });
        mockSignIn.mockResolvedValue({ success: true });
        mockGetProjects.mockResolvedValue([{ id: "project-1" }]);

        const { result } = renderHook(() => useAuth());

        await act(async () => {
          await result.current.signIn("test@example.com", "password123");
        });

        expect(mockClearAnonWork).not.toHaveBeenCalled();
        expect(mockPush).toHaveBeenCalledWith("/project-1");
      });
    });

    describe("error states", () => {
      it("should return error result when sign in fails", async () => {
        mockSignIn.mockResolvedValue({
          success: false,
          error: "Invalid credentials",
        });

        const { result } = renderHook(() => useAuth());

        let signInResult;
        await act(async () => {
          signInResult = await result.current.signIn(
            "test@example.com",
            "wrong-password"
          );
        });

        expect(signInResult).toEqual({
          success: false,
          error: "Invalid credentials",
        });
      });

      it("should not redirect when sign in fails", async () => {
        mockSignIn.mockResolvedValue({
          success: false,
          error: "Invalid credentials",
        });

        const { result } = renderHook(() => useAuth());

        await act(async () => {
          await result.current.signIn("test@example.com", "wrong-password");
        });

        expect(mockPush).not.toHaveBeenCalled();
      });
    });

    describe("loading state", () => {
      it("should set isLoading to true during sign in", async () => {
        let resolveSignIn: (value: { success: boolean }) => void;
        mockSignIn.mockImplementation(
          () =>
            new Promise((resolve) => {
              resolveSignIn = resolve;
            })
        );

        const { result } = renderHook(() => useAuth());

        expect(result.current.isLoading).toBe(false);

        let signInPromise: Promise<unknown>;
        act(() => {
          signInPromise = result.current.signIn(
            "test@example.com",
            "password123"
          );
        });

        await waitFor(() => {
          expect(result.current.isLoading).toBe(true);
        });

        await act(async () => {
          resolveSignIn!({ success: false });
          await signInPromise;
        });

        expect(result.current.isLoading).toBe(false);
      });

      it("should set isLoading to false even when an error occurs", async () => {
        mockSignIn.mockRejectedValue(new Error("Network error"));

        const { result } = renderHook(() => useAuth());

        await act(async () => {
          try {
            await result.current.signIn("test@example.com", "password123");
          } catch {
            // Expected to throw
          }
        });

        expect(result.current.isLoading).toBe(false);
      });
    });
  });

  describe("signUp", () => {
    describe("happy path", () => {
      it("should call signUpAction with email and password", async () => {
        mockSignUp.mockResolvedValue({ success: true });

        const { result } = renderHook(() => useAuth());

        await act(async () => {
          await result.current.signUp("new@example.com", "password123");
        });

        expect(mockSignUp).toHaveBeenCalledWith(
          "new@example.com",
          "password123"
        );
      });

      it("should return the result from signUpAction", async () => {
        mockSignUp.mockResolvedValue({ success: true });

        const { result } = renderHook(() => useAuth());

        let signUpResult;
        await act(async () => {
          signUpResult = await result.current.signUp(
            "new@example.com",
            "password123"
          );
        });

        expect(signUpResult).toEqual({ success: true });
      });

      it("should create new project after successful sign up", async () => {
        mockSignUp.mockResolvedValue({ success: true });
        mockGetProjects.mockResolvedValue([]);
        mockCreateProject.mockResolvedValue({ id: "new-project-id" });

        const { result } = renderHook(() => useAuth());

        await act(async () => {
          await result.current.signUp("new@example.com", "password123");
        });

        expect(mockCreateProject).toHaveBeenCalled();
        expect(mockPush).toHaveBeenCalledWith("/new-project-id");
      });
    });

    describe("with anonymous work", () => {
      it("should save anonymous work to a new project after sign up", async () => {
        const anonWorkData = {
          messages: [{ role: "user", content: "Hello" }],
          fileSystemData: { "/App.jsx": "content" },
        };
        mockGetAnonWorkData.mockReturnValue(anonWorkData);
        mockSignUp.mockResolvedValue({ success: true });
        mockCreateProject.mockResolvedValue({ id: "anon-project-id" });

        const { result } = renderHook(() => useAuth());

        await act(async () => {
          await result.current.signUp("new@example.com", "password123");
        });

        expect(mockCreateProject).toHaveBeenCalledWith(
          expect.objectContaining({
            messages: anonWorkData.messages,
            data: anonWorkData.fileSystemData,
          })
        );
        expect(mockClearAnonWork).toHaveBeenCalled();
        expect(mockPush).toHaveBeenCalledWith("/anon-project-id");
      });
    });

    describe("error states", () => {
      it("should return error result when sign up fails", async () => {
        mockSignUp.mockResolvedValue({
          success: false,
          error: "Email already registered",
        });

        const { result } = renderHook(() => useAuth());

        let signUpResult;
        await act(async () => {
          signUpResult = await result.current.signUp(
            "existing@example.com",
            "password123"
          );
        });

        expect(signUpResult).toEqual({
          success: false,
          error: "Email already registered",
        });
      });

      it("should return error when password is too short", async () => {
        mockSignUp.mockResolvedValue({
          success: false,
          error: "Password must be at least 8 characters",
        });

        const { result } = renderHook(() => useAuth());

        let signUpResult;
        await act(async () => {
          signUpResult = await result.current.signUp("new@example.com", "short");
        });

        expect(signUpResult).toEqual({
          success: false,
          error: "Password must be at least 8 characters",
        });
      });

      it("should not redirect when sign up fails", async () => {
        mockSignUp.mockResolvedValue({
          success: false,
          error: "Email already registered",
        });

        const { result } = renderHook(() => useAuth());

        await act(async () => {
          await result.current.signUp("existing@example.com", "password123");
        });

        expect(mockPush).not.toHaveBeenCalled();
      });
    });

    describe("loading state", () => {
      it("should set isLoading to true during sign up", async () => {
        let resolveSignUp: (value: { success: boolean }) => void;
        mockSignUp.mockImplementation(
          () =>
            new Promise((resolve) => {
              resolveSignUp = resolve;
            })
        );

        const { result } = renderHook(() => useAuth());

        expect(result.current.isLoading).toBe(false);

        let signUpPromise: Promise<unknown>;
        act(() => {
          signUpPromise = result.current.signUp(
            "new@example.com",
            "password123"
          );
        });

        await waitFor(() => {
          expect(result.current.isLoading).toBe(true);
        });

        await act(async () => {
          resolveSignUp!({ success: false });
          await signUpPromise;
        });

        expect(result.current.isLoading).toBe(false);
      });

      it("should set isLoading to false even when an error occurs", async () => {
        mockSignUp.mockRejectedValue(new Error("Network error"));

        const { result } = renderHook(() => useAuth());

        await act(async () => {
          try {
            await result.current.signUp("new@example.com", "password123");
          } catch {
            // Expected to throw
          }
        });

        expect(result.current.isLoading).toBe(false);
      });
    });
  });

  describe("handlePostSignIn edge cases", () => {
    it("should navigate to first project when multiple projects exist", async () => {
      mockSignIn.mockResolvedValue({ success: true });
      mockGetProjects.mockResolvedValue([
        { id: "project-1", name: "First" },
        { id: "project-2", name: "Second" },
        { id: "project-3", name: "Third" },
      ]);

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("test@example.com", "password123");
      });

      expect(mockPush).toHaveBeenCalledWith("/project-1");
    });

    it("should create project with generated name when no projects exist", async () => {
      mockSignIn.mockResolvedValue({ success: true });
      mockGetProjects.mockResolvedValue([]);
      mockCreateProject.mockResolvedValue({ id: "new-id" });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("test@example.com", "password123");
      });

      expect(mockCreateProject).toHaveBeenCalledWith(
        expect.objectContaining({
          name: expect.stringMatching(/^New Design #\d+$/),
        })
      );
    });

    it("should create project with timestamp name when anon work exists", async () => {
      mockGetAnonWorkData.mockReturnValue({
        messages: [{ content: "test" }],
        fileSystemData: {},
      });
      mockSignIn.mockResolvedValue({ success: true });
      mockCreateProject.mockResolvedValue({ id: "new-id" });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("test@example.com", "password123");
      });

      expect(mockCreateProject).toHaveBeenCalledWith(
        expect.objectContaining({
          name: expect.stringMatching(/^Design from /),
        })
      );
    });
  });
});
