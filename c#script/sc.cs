
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


    //public void UpdateScoreServerRpc(ulong playerClientId)
    //{
    //    if (playerClientId == NetworkManager.Singleton.ConnectedClientsList[0].ClientId)
    //        scorePlayer1.Value++;
    //    else
    //        scorePlayer2.Value++;
    //}


    void Awake() => Instance = this;

    void Start()
    {
        scorePlayer1.Value = 0;
        scorePlayer2.Value = 0;
        isPlayer1Turn.Value = true;
        SpawnCoins();
    }

    void Update()
    {
        scoreTextPlayer1.text = scorePlayer1.Value.ToString();
        scoreTextPlayer2.text = scorePlayer2.Value.ToString();
    }

    void SpawnCoins()
    {
        if (!IsServer) return;

        foreach (Transform pos in blackCoinPositions)
        {
            GameObject coin = Instantiate(blackCoinPrefab, pos.position, Quaternion.identity);
            coin.tag = "Black";
            coin.GetComponent<NetworkObject>().Spawn();
        }
        foreach (Transform pos in whiteCoinPositions)
        {
            GameObject coin = Instantiate(whiteCoinPrefab, pos.position, Quaternion.identity);
            coin.tag = "White";
            coin.GetComponent<NetworkObject>().Spawn();
        }
        if (queenCoinPosition != null)
        {
            GameObject coin = Instantiate(queenCoinPrefab, queenCoinPosition.position, Quaternion.identity);
            coin.tag = "Queen";
            coin.GetComponent<NetworkObject>().Spawn();
        }
    }

    [ServerRpc(RequireOwnership = false)]
    public void UpdateScoreServerRpc(ulong playerClientId, string coinType)
    {
     
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
    }

    [ServerRpc(RequireOwnership = false)]
    public void OnShotTakenServerRpc(ulong shooterClientId)
    {
      
        SwitchTurnServerRpc();
    }

    [ServerRpc(RequireOwnership = false)]
    public void SwitchTurnServerRpc()
    {
        isPlayer1Turn.Value = !isPlayer1Turn.Value;
        foreach (var striker in FindObjectsOfType<StrikerControllerNetcode>())
        {
            striker.IsMyTurn.Value = striker.OwnerClientId == (isPlayer1Turn.Value ?
                NetworkManager.Singleton.ConnectedClientsList[0].ClientId :
                NetworkManager.Singleton.ConnectedClientsList[1].ClientId);
        }
    }
}


using Unity.Netcode;
using UnityEngine;

public class CoinNetcode : NetworkBehaviour
{
    Rigidbody2D rb;

    void Awake() { rb = GetComponent<Rigidbody2D>(); }

    [ServerRpc(RequireOwnership = false)]
    public void MoveCoinServerRpc(Vector2 force)
    {
        rb.AddForce(force, ForceMode2D.Impulse);
    }

    void OnTriggerEnter2D(Collider2D other)
    {
        if (!IsServer) return;
        if (other.CompareTag("Pocket"))
        {
            if (GameManagerNetcode.Instance != null)
                GameManagerNetcode.Instance.UpdateScoreServerRpc(OwnerClientId, gameObject.tag); // Pass player id or client id
            GetComponent<NetworkObject>().Despawn();
            Destroy(gameObject);
        }
    }
}


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

    private void Start()
    {
        rb = GetComponent<Rigidbody2D>();
        isCharging = false;
    }

    void Update()
    {
        if (!IsOwner || !IsMyTurn.Value) return;

        if (Input.GetMouseButtonDown(0)) OnMouseDown();
        if (Input.GetMouseButton(0)) OnMouseDrag();
        if (Input.GetMouseButtonUp(0)) StartCoroutine(OnMouseUp());
    }

    private void OnMouseDown()
    {
        if (rb.linearVelocity.magnitude > 0.1f) return;
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

        ShootServerRpc(direction, forceMagnitude);

        yield break;
    }

    [ServerRpc]
    void ShootServerRpc(Vector3 direction, float force)
    {
        rb.AddForce(direction.normalized * force, ForceMode2D.Impulse);
        if (GameManagerNetcode.Instance != null)
            GameManagerNetcode.Instance.OnShotTakenServerRpc(OwnerClientId);
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
        }
        rb.linearVelocity = Vector2.zero;
        isCharging = false;
    }
}


using Unity.Netcode;
using UnityEngine;

public class MultiplayerMenu : MonoBehaviour
{
    public void HostGame() => NetworkManager.Singleton.StartHost();
    public void JoinGame() => NetworkManager.Singleton.StartClient();
}