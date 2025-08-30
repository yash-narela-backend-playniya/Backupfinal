              // GameManagerNetcode.cs
using Unity.Netcode;
using UnityEngine;
using TMPro;

public class GameManagerNetcode : NetworkBehaviour
{
    public static GameManagerNetcode Instance;

    public NetworkVariable<int> scorePlayer1 = new NetworkVariable<int>();
    public NetworkVariable<int> scorePlayer2 = new NetworkVariable<int>();
    public NetworkVariable<bool> isPlayer1Turn = new NetworkVariable<bool>(true);

    [SerializeField] TextMeshProUGUI scoreTextPlayer1, scoreTextPlayer2, gameOverText;
    [SerializeField] GameObject blackCoinPrefab, whiteCoinPrefab, queenCoinPrefab;
    [SerializeField] Transform[] blackCoinPositions, whiteCoinPositions;
    [SerializeField] Transform queenCoinPosition;

    void Awake() 
    { 
        if (Instance == null)
        {
            Instance = this;
            DontDestroyOnLoad(gameObject);
        }
        else
        {
            Destroy(gameObject);
        }
    }

    public override void OnNetworkSpawn()
    {
        if (IsServer)
        {
            scorePlayer1.Value = 0;
            scorePlayer2.Value = 0;
            isPlayer1Turn.Value = true;
            SpawnCoins();
            InitializePlayerTurns();
        }
    }

    void Update()
    {
        if (scoreTextPlayer1 != null) scoreTextPlayer1.text = scorePlayer1.Value.ToString();
        if (scoreTextPlayer2 != null) scoreTextPlayer2.text = scorePlayer2.Value.ToString();
    }

    void SpawnCoins()
    {
        if (!IsServer) return;

        // Spawn black coins
        foreach (Transform pos in blackCoinPositions)
        {
            GameObject coin = Instantiate(blackCoinPrefab, pos.position, Quaternion.identity);
            coin.tag = "Black";
            NetworkObject networkObj = coin.GetComponent<NetworkObject>();
            if (networkObj != null)
            {
                networkObj.Spawn();
            }
        }

        // Spawn white coins
        foreach (Transform pos in whiteCoinPositions)
        {
            GameObject coin = Instantiate(whiteCoinPrefab, pos.position, Quaternion.identity);
            coin.tag = "White";
            NetworkObject networkObj = coin.GetComponent<NetworkObject>();
            if (networkObj != null)
            {
                networkObj.Spawn();
            }
        }

        // Spawn queen coin
        if (queenCoinPosition != null)
        {
            GameObject coin = Instantiate(queenCoinPrefab, queenCoinPosition.position, Quaternion.identity);
            coin.tag = "Queen";
            NetworkObject networkObj = coin.GetComponent<NetworkObject>();
            if (networkObj != null)
            {
                networkObj.Spawn();
            }
        }
    }

    void InitializePlayerTurns()
    {
        if (!IsServer) return;
        
        // Wait a frame for all objects to spawn properly
        StartCoroutine(SetInitialTurns());
    }

    System.Collections.IEnumerator SetInitialTurns()
    {
        yield return new WaitForEndOfFrame();
        SwitchTurnServerRpc();
    }

    [ServerRpc(RequireOwnership = false)]
    public void UpdateScoreServerRpc(ulong playerClientId, string coinType)
    {
        if (NetworkManager.Singleton.ConnectedClientsList.Count < 2) return;

        if (playerClientId == NetworkManager.Singleton.ConnectedClientsList[0].ClientId)
        {
            if (coinType == "Black") scorePlayer1.Value++;
            else if (coinType == "White") scorePlayer1.Value++;
            else if (coinType == "Queen") scorePlayer1.Value += 3;
        }
        else
        {
            if (coinType == "Black") scorePlayer2.Value++;
            else if (coinType == "White") scorePlayer2.Value++;
            else if (coinType == "Queen") scorePlayer2.Value += 3;
        }

        // Check for game over conditions here if needed
        CheckGameOver();
    }

    void CheckGameOver()
    {
        // Add your game over logic here
        // For example, when all coins are pocketed
    }

    [ServerRpc(RequireOwnership = false)]
    public void OnShotTakenServerRpc(ulong shooterClientId)
    {
        // Switch turn after shot
        SwitchTurnServerRpc();
    }

    [ServerRpc(RequireOwnership = false)]
    public void SwitchTurnServerRpc()
    {
        if (NetworkManager.Singleton.ConnectedClientsList.Count < 2) return;

        isPlayer1Turn.Value = !isPlayer1Turn.Value;
        
        ulong currentPlayerClientId = isPlayer1Turn.Value ? 
            NetworkManager.Singleton.ConnectedClientsList[0].ClientId : 
            NetworkManager.Singleton.ConnectedClientsList[1].ClientId;

        // Update all strikers
        foreach (var striker in FindObjectsOfType<StrikerControllerNetcode>())
        {
            striker.SetTurnClientRpc(striker.OwnerClientId == currentPlayerClientId);
        }
    }
}

// CoinNetcode.cs
using Unity.Netcode;
using UnityEngine;

public class CoinNetcode : NetworkBehaviour
{
    Rigidbody2D rb;

    void Awake() 
    { 
        rb = GetComponent<Rigidbody2D>(); 
    }

    public override void OnNetworkSpawn()
    {
        // Ensure the coin has proper physics setup
        if (rb == null) rb = GetComponent<Rigidbody2D>();
    }

    [ServerRpc(RequireOwnership = false)]
    public void MoveCoinServerRpc(Vector2 force)
    {
        if (rb != null)
        {
            rb.AddForce(force, ForceMode2D.Impulse);
        }
    }

    void OnTriggerEnter2D(Collider2D other)
    {
        if (!IsServer) return;
        
        if (other.CompareTag("Pocket"))
        {
            if (GameManagerNetcode.Instance != null)
            {
                // Get the client ID of the current player who made the shot
                ulong currentPlayerClientId = GameManagerNetcode.Instance.isPlayer1Turn.Value ? 
                    NetworkManager.Singleton.ConnectedClientsList[0].ClientId : 
                    NetworkManager.Singleton.ConnectedClientsList[1].ClientId;
                
                GameManagerNetcode.Instance.UpdateScoreServerRpc(currentPlayerClientId, gameObject.tag);
            }
            
            // Despawn and destroy the coin
            NetworkObject networkObj = GetComponent<NetworkObject>();
            if (networkObj != null && networkObj.IsSpawned)
            {
                networkObj.Despawn();
            }
            Destroy(gameObject);
        }
    }
}

// StrikerControllerNetcode.cs
using Unity.Netcode;
using UnityEngine;
using UnityEngine.UI;
using System.Collections;

public class StrikerControllerNetcode : NetworkBehaviour
{
    [SerializeField] float strikerSpeed = 100f;
    [SerializeField] float maxScale = 1f;
    [SerializeField] Transform strikerForceField;
    [SerializeField] Slider strikerSlider;

    Rigidbody2D rb;
    bool isCharging;
    public NetworkVariable<bool> IsMyTurn = new NetworkVariable<bool>();

    public override void OnNetworkSpawn()
    {
        rb = GetComponent<Rigidbody2D>();
        isCharging = false;
        
        // Reset striker position when spawned
        ResetStrikerPosition();
    }

    void Update()
    {
        if (!IsOwner || !IsMyTurn.Value) return;

        // Only allow input if striker is not moving
        if (rb.linearVelocity.magnitude > 0.1f) return;

        if (Input.GetMouseButtonDown(0)) OnMouseDown();
        if (Input.GetMouseButton(0)) OnMouseDrag();
        if (Input.GetMouseButtonUp(0)) StartCoroutine(OnMouseUp());
    }

    private void OnMouseDown()
    {
        if (rb.linearVelocity.magnitude > 0.1f) return;
        
        // Check if mouse is over the striker
        Vector3 mouseWorld = Camera.main.ScreenToWorldPoint(Input.mousePosition);
        mouseWorld.z = transform.position.z;
        
        if (Vector3.Distance(mouseWorld, transform.position) > 1f) return; // Only if close to striker
        
        isCharging = true;
        if (strikerForceField != null)
            strikerForceField.gameObject.SetActive(true);
    }

    private IEnumerator OnMouseUp()
    {
        if (!isCharging) yield break;
        
        isCharging = false;
        if (strikerForceField != null)
            strikerForceField.gameObject.SetActive(false);

        Vector3 mouseWorld = Camera.main.ScreenToWorldPoint(Input.mousePosition);
        Vector3 direction = transform.position - mouseWorld;
        direction.z = 0f;
        
        float forceMagnitude = Mathf.Clamp(direction.magnitude * strikerSpeed, 0f, 30f);

        if (forceMagnitude > 1f) // Only shoot if there's enough force
        {
            ShootServerRpc(direction.normalized, forceMagnitude);
        }

        yield break;
    }

    [ServerRpc]
    void ShootServerRpc(Vector3 direction, float force)
    {
        if (rb != null)
        {
            rb.AddForce(direction * force, ForceMode2D.Impulse);
            
            // Apply force to nearby coins
            ApplyForceToNearbyCoins(direction, force);
            
            if (GameManagerNetcode.Instance != null)
                GameManagerNetcode.Instance.OnShotTakenServerRpc(OwnerClientId);
        }
    }

    void ApplyForceToNearbyCoins(Vector3 direction, float force)
    {
        // Find all coins within a certain radius and apply force
        Collider2D[] nearbyObjects = Physics2D.OverlapCircleAll(transform.position, 1f);
        
        foreach (var obj in nearbyObjects)
        {
            CoinNetcode coin = obj.GetComponent<CoinNetcode>();
            if (coin != null)
            {
                Vector2 coinDirection = (obj.transform.position - transform.position).normalized;
                coin.MoveCoinServerRpc(coinDirection * force * 0.5f); // Reduced force for coins
            }
        }
    }

    [ClientRpc]
    public void SetTurnClientRpc(bool isMyTurn)
    {
        IsMyTurn.Value = isMyTurn;
    }

    private void OnMouseDrag()
    {
        if (!isCharging || strikerForceField == null) return;
        
        Vector3 mouseWorld = Camera.main.ScreenToWorldPoint(Input.mousePosition);
        Vector3 direction = transform.position - mouseWorld;
        direction.z = 0f;
        
        strikerForceField.LookAt(transform.position + direction);
        float scaleValue = Mathf.Min(Vector3.Distance(transform.position, transform.position + direction / 4f), maxScale);
        strikerForceField.localScale = new Vector3(scaleValue, scaleValue, scaleValue);
    }

    public void ResetStrikerPosition()
    {
        if (strikerSlider != null)
        {
            transform.position = new Vector3(strikerSlider.value, -4.57f, 0);
        }
        else
        {
            transform.position = new Vector3(0, -4.57f, 0);
        }
        
        if (strikerForceField != null)
        {
            strikerForceField.LookAt(transform.position);
            strikerForceField.localScale = Vector3.zero;
            strikerForceField.gameObject.SetActive(false);
        }
        
        if (rb != null)
        {
            rb.linearVelocity = Vector2.zero;
            rb.angularVelocity = 0f;
        }
        
        isCharging = false;
    }
}

// MultiplayerMenu.cs (unchanged)
using Unity.Netcode;
using UnityEngine;

public class MultiplayerMenu : MonoBehaviour
{
    public void HostGame() => NetworkManager.Singleton.StartHost();
    public void JoinGame() => NetworkManager.Singleton.StartClient();
}








