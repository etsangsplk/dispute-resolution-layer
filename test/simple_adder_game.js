const BasicVerificationGame = artifacts.require("./BasicVerificationGame.sol")
const SimpleAdderVM = artifacts.require("./test/SimpleAdderVM.sol")
const web3 = require('web3')

const toResult = (data) => {
  return {
    state: "0x" + data[0].slice(-2),//because of encoding issues, uhhhh....
    stateHash: data[1]
  }
}

contract('BasicVerificationGame', function(accounts) {
  let basicVerificationGame, simpleAdderVM, gameId

  let program = "0x010203040506070809"
  let programLength = (program.length / 2) - 2
  let output = "0x000000000000000000000000000000000000000000000000000000000000002d"//45
  let step = programLength - 1
  let outputHash = web3.utils.soliditySha3(output)
  let responseTime = 20

  before(async () => {
    basicVerificationGame = await BasicVerificationGame.deployed()
    simpleAdderVM = await SimpleAdderVM.deployed()
  })

  it("should properly add numbers", async () => {
    assert.equal(
      "0x0000000000000000000000000000000000000000000000000000000000000003",
      await simpleAdderVM.runStep.call("0x01", "0x02")
    )
  })

  it("should properly run steps", async () => {
    assert.equal(
      "0x24",
      toResult(await simpleAdderVM.runSteps.call(program, step)).state
    )
  })

  it("should create a new verification game", async () => {
    let tx = await basicVerificationGame.newGame(accounts[1], accounts[2], program, outputHash, programLength, responseTime, SimpleAdderVM.address)
    const result = tx.logs[0].args
    gameId = result.gameId
    assert.equal(result.solver, accounts[1])
    assert.equal(result.verifier, accounts[2])
  })

  it("should query a step", async () => {
    //query final step to make verification game short
    let tx = await basicVerificationGame.query(gameId, step, {from: accounts[2]})

    let query = tx.logs[0].args
    assert.equal(query.stepNumber.toNumber(), step)
    assert.equal(query.gameId, gameId)
  })

  it("should respond to query", async () => {
    let result = toResult(await simpleAdderVM.runSteps.call(program, step))

    let tx = await basicVerificationGame.respond(gameId, result.stateHash, {from: accounts[1]})

    let response = tx.logs[0].args
    assert.equal(response.hash, result.stateHash)
    assert.equal(response.gameId, gameId)
  })

  it("should perform step verification", async () => {
    let result = toResult(await simpleAdderVM.runSteps.call(program, step))
    await basicVerificationGame.performStepVerification(gameId, result.state, "0x09", outputHash, {from: accounts[1]})

    assert(1, await basicVerificationGame.status.call(gameId))
  })
})