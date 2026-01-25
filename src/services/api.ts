import { User, Goal, WorkoutDay } from '../types';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
const REQUEST_TIMEOUT = 30000; // 30 seconds
const CACHE_TTL = 5000; // 5 seconds cache for GET requests

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

interface PendingRequest<T> {
  promise: Promise<T>;
  timestamp: number;
}

class ApiService {
  private cache: Map<string, CacheEntry<unknown>> = new Map();
  private pendingRequests: Map<string, PendingRequest<unknown>> = new Map();

  /**
   * Clear the cache for a specific endpoint or all endpoints
   */
  clearCache(endpoint?: string): void {
    if (endpoint) {
      // Clear specific endpoint and related endpoints
      const keysToDelete: string[] = [];
      this.cache.forEach((_, key) => {
        if (key.includes(endpoint)) {
          keysToDelete.push(key);
        }
      });
      keysToDelete.forEach(key => this.cache.delete(key));
    } else {
      this.cache.clear();
    }
  }

  /**
   * Fetch with timeout support
   */
  private fetchWithTimeout(url: string, options?: RequestInit): Promise<Response> {
    return new Promise((resolve, reject) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
        reject(new Error(`Request timeout after ${REQUEST_TIMEOUT}ms`));
      }, REQUEST_TIMEOUT);

      fetch(url, {
        ...options,
        signal: controller.signal,
      })
        .then(response => {
          clearTimeout(timeoutId);
          resolve(response);
        })
        .catch(error => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }

  private async fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    const method = options?.method || 'GET';
    const cacheKey = `${method}:${url}`;

    // For GET requests, check cache first
    if (method === 'GET') {
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.data as T;
      }

      // Check for pending request (deduplication)
      const pending = this.pendingRequests.get(cacheKey);
      if (pending && Date.now() - pending.timestamp < REQUEST_TIMEOUT) {
        return pending.promise as Promise<T>;
      }
    }

    // Create the request promise
    const requestPromise = (async (): Promise<T> => {
      try {
        const response = await this.fetchWithTimeout(url, {
          headers: {
            'Content-Type': 'application/json',
            ...options?.headers,
          },
          ...options,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        // Cache GET responses
        if (method === 'GET') {
          this.cache.set(cacheKey, { data, timestamp: Date.now() });
        } else {
          // Invalidate related caches on mutations
          this.invalidateRelatedCaches(endpoint);
        }

        return data;
      } finally {
        // Remove from pending requests
        this.pendingRequests.delete(cacheKey);
      }
    })();

    // Track pending GET requests for deduplication
    if (method === 'GET') {
      this.pendingRequests.set(cacheKey, { promise: requestPromise, timestamp: Date.now() });
    }

    return requestPromise;
  }

  /**
   * Invalidate caches related to a mutated endpoint
   */
  private invalidateRelatedCaches(endpoint: string): void {
    // Extract the resource type from the endpoint
    const resourceMatch = endpoint.match(/^\/(\w+)/);
    if (resourceMatch) {
      const resource = resourceMatch[1];
      const keysToDelete: string[] = [];
      this.cache.forEach((_, key) => {
        if (key.includes(`/${resource}`)) {
          keysToDelete.push(key);
        }
      });
      keysToDelete.forEach(key => this.cache.delete(key));
    }
  }

  // ==================== USER METHODS ====================

  async getUsers(): Promise<User[]> {
    console.log('🔍 Fetching users from database...');
    return this.fetchApi<User[]>('/users');
  }

  async getUser(id: string): Promise<User> {
    console.log(`🔍 Fetching user ${id} from database...`);
    return this.fetchApi<User>(`/users/${id}`);
  }

  async createUser(userData: Partial<User>): Promise<User> {
    console.log('➕ Creating user in database...', userData);
    return this.fetchApi<User>('/users', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }

  async updateUser(id: string, userData: Partial<User>): Promise<User> {
    console.log(`✏️ Updating user ${id} in database...`, userData);
    return this.fetchApi<User>(`/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(userData),
    });
  }

  async deleteUser(id: string): Promise<void> {
    console.log(`🗑️ Deleting user ${id} from database...`);
    await this.fetchApi<void>(`/users/${id}`, {
      method: 'DELETE',
    });
  }

  // ==================== WORKOUT METHODS ====================

  async getAllWorkouts(): Promise<WorkoutDay[]> {
    console.log('🔍 Fetching all workouts from database...');
    return this.fetchApi<WorkoutDay[]>('/workouts');
  }

  async getUserWorkouts(userId: string): Promise<WorkoutDay[]> {
    console.log(`🔍 Fetching all workouts for user ${userId}...`);
    return this.fetchApi<WorkoutDay[]>(`/workouts/user/${userId}`);
  }

  async getWorkouts(userId: string, week: number): Promise<WorkoutDay[]> {
    console.log(`🔍 Fetching workouts for user ${userId}, week ${week}...`);
    return this.fetchApi<WorkoutDay[]>(`/workouts/${userId}/${week}`);
  }

  async saveWorkout(workoutData: Partial<WorkoutDay>): Promise<WorkoutDay> {
    console.log('💪 Saving workout to database...', workoutData);
    return this.fetchApi<WorkoutDay>('/workouts', {
      method: 'POST',
      body: JSON.stringify(workoutData),
    });
  }

  async deleteWorkout(id: string): Promise<void> {
    console.log(`🗑️ Deleting workout ${id} from database...`);
    await this.fetchApi<void>(`/workouts/${id}`, {
      method: 'DELETE',
    });
  }

  async getWorkoutStats(userId: string): Promise<{
    totalWorkouts: number;
    completedWorkouts: number;
    weeksWithData: number;
    latestWeek: number;
    completionRate: number;
  }> {
    console.log(`📊 Fetching workout stats for user ${userId}...`);
    return this.fetchApi(`/workouts/stats/${userId}`);
  }

  // ==================== HEALTH CHECK ====================

  async healthCheck(): Promise<{ status: string; message: string }> {
    return this.fetchApi<{ status: string; message: string }>('/health');
  }

  // ==================== GOALS METHODS ====================

  async getAllGoals(): Promise<Goal[]> {
    console.log('🔍 Fetching all goals from database...');
    return this.fetchApi<Goal[]>('/goals');
  }

  async getUserGoals(userId: string): Promise<Goal[]> {
    console.log(`🔍 Fetching goals for user ${userId}...`);
    return this.fetchApi<Goal[]>(`/goals/user/${userId}`);
  }

  async getGoal(id: string): Promise<Goal> {
    console.log(`🔍 Fetching goal ${id} from database...`);
    return this.fetchApi<Goal>(`/goals/${id}`);
  }

  async createGoal(goalData: Partial<Goal>): Promise<Goal> {
    console.log('➕ Creating goal in database...', goalData);
    return this.fetchApi<Goal>('/goals', {
      method: 'POST',
      body: JSON.stringify(goalData),
    });
  }

  async updateGoal(id: string, goalData: Partial<Goal>): Promise<Goal> {
    console.log(`✏️ Updating goal ${id} in database...`, goalData);
    return this.fetchApi<Goal>(`/goals/${id}`, {
      method: 'PUT',
      body: JSON.stringify(goalData),
    });
  }

  async deleteGoal(id: string): Promise<void> {
    console.log(`🗑️ Deleting goal ${id} from database...`);
    await this.fetchApi<void>(`/goals/${id}`, {
      method: 'DELETE',
    });
  }

  async getGoalStats(userId: string): Promise<{
    totalGoals: number;
    completedGoals: number;
    difficultGoals: number;
    categoriesCovered: number;
    completionRate: number;
  }> {
    console.log(`📊 Fetching goal stats for user ${userId}...`);
    return this.fetchApi(`/goals/stats/${userId}`);
  }

  // ==================== CONNECTION TEST ====================

  async testConnection(): Promise<boolean> {
    try {
      const health = await this.healthCheck();
      console.log('✅ Database connection test successful:', health);
      return true;
    } catch (error) {
      console.error('❌ Database connection test failed:', error);
      return false;
    }
  }
}

// Export singleton instance
export const apiService = new ApiService();
export default apiService;