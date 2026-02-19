/**
 * WebRTC IP Discovery Module
 * 
 * Uses WebRTC ICE (Interactive Connectivity Establishment) candidate gathering
 * to discover local and public IP addresses of the device.
 * 
 * How it works:
 * 1. Creates a temporary RTCPeerConnection with public STUN servers
 * 2. Creates a dummy data channel to trigger ICE gathering
 * 3. Listens for ICE candidate events containing IP addresses
 * 4. Parses candidates to extract and categorize IPs
 * 5. Cleans up connection after gathering completes or times out
 * 
 * Browser Support:
 * - Chrome/Edge: Full support
 * - Firefox: Full support
 * - Safari: Partial support (may require user permission)
 * 
 * Privacy Note:
 * Some browsers may restrict IP discovery for privacy reasons.
 * This is a progressive enhancement - exam access works without it.
 * 
 * @module webrtcIpDiscovery
 * @see Requirements 1.1-1.5
 * @see https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection
 */

/**
 * Represents a single discovered IP address with metadata
 */
export interface DiscoveredIP {
  ip: string;                    // IP address (e.g., "192.168.1.5" or "2001:0db8::1")
  type: 'local' | 'public';      // Local (host) or public (server reflexive) IP
  family: 'IPv4' | 'IPv6';       // IP address family
  source: 'webrtc';              // Always 'webrtc' for this module
}

/**
 * Result of IP discovery operation
 */
export interface IPDiscoveryResult {
  ips: DiscoveredIP[];     // Array of discovered IP addresses (may be empty)
  error: string | null;    // Error message if discovery failed or timed out
  completedAt: string;     // ISO timestamp when discovery completed
}

/**
 * Parses an ICE candidate string to extract IP address information
 * 
 * ICE candidate format example:
 * "candidate:842163049 1 udp 1677729535 192.168.1.5 58678 typ srflx"
 * 
 * @param candidateStr - The ICE candidate string
 * @returns DiscoveredIP object or null if parsing fails
 */
export function parseICECandidate(candidateStr: string): DiscoveredIP | null {
  try {
    // Validate input
    if (!candidateStr || typeof candidateStr !== 'string') {
      return null;
    }
    
    let ip: string | null = null;
    let family: 'IPv4' | 'IPv6' | null = null;
    
    // Split the candidate string by spaces to find the IP address
    // ICE candidate format: "candidate:<foundation> <component> <protocol> <priority> <ip> <port> typ <type> ..."
    const parts = candidateStr.split(/\s+/);
    
    // Look for IP address in the parts (usually at index 4 after splitting)
    for (const part of parts) {
      // Check if it's an IPv4 address
      const ipv4Regex = /^([0-9]{1,3}(\.[0-9]{1,3}){3})$/;
      const ipv4Match = part.match(ipv4Regex);
      if (ipv4Match) {
        ip = ipv4Match[1];
        family = 'IPv4';
        break;
      }
      
      // Check if it's an IPv6 address (contains colons)
      if (part.includes(':') && !part.includes('candidate:')) {
        // Simple validation: IPv6 addresses contain colons and hex digits
        const ipv6Regex = /^([0-9a-f:]+)$/i;
        const ipv6Match = part.match(ipv6Regex);
        if (ipv6Match && ipv6Match[1]) {
          // Additional check: must have at least 2 colons for valid IPv6
          if ((ipv6Match[1].match(/:/g) || []).length >= 2) {
            ip = ipv6Match[1];
            family = 'IPv6';
            break;
          }
        }
      }
    }
    
    if (!ip || !family) {
      return null;
    }
    
    // Determine type from 'typ' field
    // host = local IP, srflx = server reflexive (public IP)
    let type: 'local' | 'public' = 'local';
    if (candidateStr.includes('typ srflx') || candidateStr.includes('typ relay')) {
      type = 'public';
    } else if (candidateStr.includes('typ host')) {
      type = 'local';
    }
    
    return {
      ip,
      type,
      family,
      source: 'webrtc'
    };
  } catch (error) {
    console.warn('[WebRTC IP Discovery] Failed to parse ICE candidate:', {
      error: error instanceof Error ? error.message : String(error),
      candidateStr: candidateStr?.substring(0, 100) // Log first 100 chars for debugging
    });
    return null;
  }
}

/**
 * Discovers local and public IP addresses using WebRTC ICE candidates
 * 
 * Creates a temporary RTCPeerConnection with public STUN servers to gather
 * ICE candidates, then extracts and categorizes IP addresses from the candidates.
 * 
 * @param timeout - Maximum time to wait for IP discovery in milliseconds (default: 5000ms)
 * @returns Promise resolving to discovered IPs and any errors
 */
export async function discoverIPs(timeout: number = 5000): Promise<IPDiscoveryResult> {
  const startTime = Date.now();
  const discoveredIPs: DiscoveredIP[] = [];
  const seenIPs = new Set<string>(); // Prevent duplicates
  let error: string | null = null;
  
  return new Promise((resolve) => {
    // Check if WebRTC is supported
    if (typeof window === 'undefined' || !window.RTCPeerConnection) {
      console.warn('[WebRTC IP Discovery] WebRTC not supported in this environment');
      resolve({
        ips: [],
        error: 'WebRTC not supported',
        completedAt: new Date().toISOString()
      });
      return;
    }
    
    let pc: RTCPeerConnection | null = null;
    let timeoutId: NodeJS.Timeout | null = null;
    let completed = false;
    
    const cleanup = () => {
      if (completed) return;
      completed = true;
      
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      
      if (pc) {
        try {
          pc.close();
        } catch (e) {
          console.warn('[WebRTC IP Discovery] Error closing RTCPeerConnection:', {
            error: e instanceof Error ? e.message : String(e)
          });
        }
      }
      
      // Log successful completion
      if (discoveredIPs.length > 0 && !error) {
        console.log('[WebRTC IP Discovery] Successfully discovered IPs:', {
          count: discoveredIPs.length,
          types: discoveredIPs.map(ip => `${ip.type}:${ip.family}`),
          duration: Date.now() - startTime
        });
      }
      
      resolve({
        ips: discoveredIPs,
        error,
        completedAt: new Date().toISOString()
      });
    };
    
    try {
      // Configure STUN servers for ICE candidate gathering
      const config: RTCConfiguration = {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' }
        ]
      };
      
      pc = new RTCPeerConnection(config);
      
      // Listen for ICE candidates
      pc.onicecandidate = (event) => {
        if (!event.candidate) {
          // null candidate means gathering is complete
          cleanup();
          return;
        }
        
        const candidateStr = event.candidate.candidate;
        if (!candidateStr) return;
        
        const parsedIP = parseICECandidate(candidateStr);
        if (parsedIP && !seenIPs.has(parsedIP.ip)) {
          seenIPs.add(parsedIP.ip);
          discoveredIPs.push(parsedIP);
        }
      };
      
      // Handle ICE gathering state changes
      pc.onicegatheringstatechange = () => {
        if (pc && pc.iceGatheringState === 'complete') {
          cleanup();
        }
      };
      
      // Handle errors
      pc.onicecandidateerror = (event: any) => {
        console.warn('[WebRTC IP Discovery] ICE candidate error:', {
          errorCode: event.errorCode,
          errorText: event.errorText,
          url: event.url,
          address: event.address
        });
        if (!error) {
          error = `ICE candidate error: ${event.errorText || 'unknown'}`;
        }
      };
      
      // Create a dummy data channel to trigger ICE gathering
      pc.createDataChannel('');
      
      // Create offer to start ICE gathering
      pc.createOffer()
        .then((offer) => {
          if (pc && !completed) {
            return pc.setLocalDescription(offer);
          }
        })
        .catch((err) => {
          console.error('[WebRTC IP Discovery] Failed to create offer:', {
            error: err instanceof Error ? err.message : String(err),
            name: err instanceof Error ? err.name : undefined
          });
          error = `Failed to create offer: ${err.message}`;
          cleanup();
        });
      
      // Set timeout
      timeoutId = setTimeout(() => {
        if (!completed) {
          const timeoutError = discoveredIPs.length === 0 
            ? 'IP discovery timeout - no IPs found'
            : 'IP discovery timeout - partial results';
          
          console.warn('[WebRTC IP Discovery] Timeout reached:', {
            timeout,
            discoveredCount: discoveredIPs.length,
            duration: Date.now() - startTime
          });
          
          if (discoveredIPs.length === 0) {
            error = timeoutError;
          } else {
            error = timeoutError;
          }
          cleanup();
        }
      }, timeout);
      
    } catch (err: any) {
      console.error('[WebRTC IP Discovery] Unexpected error:', {
        error: err instanceof Error ? err.message : String(err),
        name: err instanceof Error ? err.name : undefined,
        stack: err instanceof Error ? err.stack : undefined
      });
      error = `WebRTC error: ${err.message || 'unknown'}`;
      cleanup();
    }
  });
}
