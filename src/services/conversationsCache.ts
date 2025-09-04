


interface CacheEntry<T> {
	data: T
	timestamp: number
	expiresAt: number
}

export interface ConversationsCacheData {
	sessions: any[]
	sessionRequests: Record<string, any[]>
	requestDetails: Record<string, any>
	adminFeedback: Record<string, any>
}

class ConversationsCache {
	private memoryCache = new Map<string, CacheEntry<any>>()
	private readonly CACHE_DURATION = 5 * 60 * 1000 // 5분
	private readonly MAX_CACHE_SIZE = 50

	// 메모리 캐시에서 데이터 가져오기
	get<T>(key: string): T | null {
		const entry = this.memoryCache.get(key)
		if (!entry) return null

		if (Date.now() > entry.expiresAt) {
			this.memoryCache.delete(key)
			return null
		}

		return entry.data
	}

	// 메모리 캐시에 데이터 저장
	set<T>(key: string, data: T): void {
		// 캐시 크기 제한
		if (this.memoryCache.size >= this.MAX_CACHE_SIZE) {
			const firstKey = this.memoryCache.keys().next().value
			if (firstKey) {
				this.memoryCache.delete(firstKey)
			}
		}

		this.memoryCache.set(key, {
			data,
			timestamp: Date.now(),
			expiresAt: Date.now() + this.CACHE_DURATION
		})
	}

	// 로컬스토리지에서 데이터 가져오기
	getFromStorage<T>(key: string): T | null {
		try {
			const stored = localStorage.getItem(`conversations_${key}`)
			if (!stored) return null

			const entry: CacheEntry<T> = JSON.parse(stored)
			if (Date.now() > entry.expiresAt) {
				localStorage.removeItem(`conversations_${key}`)
				return null
			}

			return entry.data
		} catch (error) {
			console.error('Failed to get from localStorage:', error)
			return null
		}
	}

	// 로컬스토리지에 데이터 저장
	setToStorage<T>(key: string, data: T): void {
		try {
			const entry: CacheEntry<T> = {
				data,
				timestamp: Date.now(),
				expiresAt: Date.now() + this.CACHE_DURATION
			}
			localStorage.setItem(`conversations_${key}`, JSON.stringify(entry))
		} catch (error) {
			console.error('Failed to save to localStorage:', error)
		}
	}

	// 캐시 무효화
	invalidate(pattern?: string): void {
		if (pattern) {
			for (const key of this.memoryCache.keys()) {
				if (key.includes(pattern)) {
					this.memoryCache.delete(key)
				}
			}
		} else {
			this.memoryCache.clear()
		}
	}

	// 캐시 키 생성
	generateKey(startDate: string, endDate: string): string {
		return `conversations_${startDate}_${endDate}`
	}
}

export const conversationsCache = new ConversationsCache()