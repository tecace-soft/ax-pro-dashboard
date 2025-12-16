


interface CacheEntry<T> {
	data: T
	timestamp: number
	expiresAt: number
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
			
			const serialized = JSON.stringify(entry)
			const estimatedSize = new Blob([serialized]).size
			
			// 데이터가 너무 크면 (5MB 이상) localStorage에 저장하지 않음
			const MAX_STORAGE_SIZE = 5 * 1024 * 1024 // 5MB
			if (estimatedSize > MAX_STORAGE_SIZE) {
				console.warn(`Cache entry too large (${(estimatedSize / 1024 / 1024).toFixed(2)}MB), skipping localStorage save for key: ${key}`)
				return
			}
			
			// 저장 전에 오래된 캐시 정리
			this.cleanupOldCache()
			
			localStorage.setItem(`conversations_${key}`, serialized)
		} catch (error: any) {
			// QuotaExceededError인 경우 오래된 캐시를 정리하고 재시도
			if (error?.name === 'QuotaExceededError' || error?.message?.includes('quota')) {
				console.warn('localStorage quota exceeded, cleaning up old cache...')
				this.cleanupOldCache(true) // 강제 정리
				
				try {
					// 재시도 (더 작은 데이터만 저장)
					const entry: CacheEntry<T> = {
						data,
						timestamp: Date.now(),
						expiresAt: Date.now() + this.CACHE_DURATION
					}
					localStorage.setItem(`conversations_${key}`, JSON.stringify(entry))
				} catch (retryError) {
					console.warn('Failed to save to localStorage after cleanup, using memory cache only:', retryError)
					// 메모리 캐시에만 저장
					this.set(key, data)
				}
			} else {
				console.error('Failed to save to localStorage:', error)
				// 메모리 캐시에만 저장
				this.set(key, data)
			}
		}
	}

	// 오래된 캐시 정리
	private cleanupOldCache(force: boolean = false): void {
		try {
			const now = Date.now()
			const keysToRemove: string[] = []
			
			// conversations_로 시작하는 모든 키 찾기
			for (let i = 0; i < localStorage.length; i++) {
				const key = localStorage.key(i)
				if (key && key.startsWith('conversations_')) {
					try {
						const stored = localStorage.getItem(key)
						if (stored) {
							const entry: CacheEntry<any> = JSON.parse(stored)
							// 만료되었거나 강제 정리인 경우 삭제 대상에 추가
							if (force || now > entry.expiresAt) {
								keysToRemove.push(key)
							}
						}
					} catch (e) {
						// 파싱 실패한 항목도 삭제
						keysToRemove.push(key)
					}
				}
			}
			
			// 오래된 항목 삭제
			keysToRemove.forEach(key => {
				localStorage.removeItem(key)
			})
			
			if (keysToRemove.length > 0) {
				console.log(`Cleaned up ${keysToRemove.length} old cache entries`)
			}
			
			// 여전히 용량이 부족하면 가장 오래된 항목부터 삭제
			if (force && keysToRemove.length === 0) {
				const conversationsKeys: Array<{ key: string; timestamp: number }> = []
				
				for (let i = 0; i < localStorage.length; i++) {
					const key = localStorage.key(i)
					if (key && key.startsWith('conversations_')) {
						try {
							const stored = localStorage.getItem(key)
							if (stored) {
								const entry: CacheEntry<any> = JSON.parse(stored)
								conversationsKeys.push({ key, timestamp: entry.timestamp })
							}
						} catch (e) {
							// 파싱 실패한 항목은 타임스탬프를 0으로 설정
							conversationsKeys.push({ key: key, timestamp: 0 })
						}
					}
				}
				
				// 타임스탬프 순으로 정렬 (오래된 것부터)
				conversationsKeys.sort((a, b) => a.timestamp - b.timestamp)
				
				// 가장 오래된 항목들 삭제 (최대 10개)
				const toRemove = conversationsKeys.slice(0, Math.min(10, conversationsKeys.length))
				toRemove.forEach(({ key }) => {
					localStorage.removeItem(key)
				})
				
				if (toRemove.length > 0) {
					console.log(`Removed ${toRemove.length} oldest cache entries to free up space`)
				}
			}
		} catch (error) {
			console.error('Failed to cleanup old cache:', error)
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